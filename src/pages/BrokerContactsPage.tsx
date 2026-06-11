import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  DollarSign,
  Facebook,
  Globe2,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { brokerSupabase, type AppUserRow, type BrokerProfileRow } from '@/lib/broker-supabase';
import LogoLoader from '@/components/LogoLoader';

const CAMPAIGN_OPTIONS = ['CPL', 'CPQ', 'CPA', 'Retainer'] as const;

type BrokerContact = {
  profile: BrokerProfileRow;
  appUser: AppUserRow | null;
};

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();

const compactList = (values: string[] | null | undefined, max = 6) => {
  const clean = (values ?? []).map((value) => value.trim()).filter(Boolean);
  if (clean.length <= max) return { visible: clean, hiddenCount: 0 };
  return { visible: clean.slice(0, max), hiddenCount: clean.length - max };
};

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return 'Not set';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined) return 'Not set';
  return new Intl.NumberFormat('en-US').format(value);
};

const formatStatus = (value: string | null | undefined) => {
  const normalized = normalize(value || 'active');
  if (!normalized) return 'Active';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const statusBadgeClass = (value: string | null | undefined) => {
  const normalized = normalize(value || 'active');
  if (['inactive', 'disabled', 'banned', 'suspended'].includes(normalized)) {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
};

const withProtocol = (url: string | null | undefined) => {
  const trimmed = String(url ?? '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const getDisplayName = (contact: BrokerContact) =>
  contact.profile.full_name?.trim() ||
  contact.appUser?.display_name?.trim() ||
  contact.profile.primary_email?.trim() ||
  contact.appUser?.email?.trim() ||
  'Unnamed broker';

const getPrimaryEmail = (contact: BrokerContact) =>
  contact.profile.primary_email?.trim() || contact.appUser?.email?.trim() || null;

const BrokerContactsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<BrokerContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchBrokerContacts = useCallback(async (showToast = false) => {
    try {
      setRefreshing(true);

      const { data: profiles, error: profileError } = await brokerSupabase
        .from('broker_profiles')
        .select(
          'user_id,full_name,company_name,bio,years_in_business,languages,primary_email,personal_email,direct_phone,office_address,website_url,preferred_contact,linkedin_username,instagram_username,facebook_username,active_models,active_states,primary_campaign,number_of_attorneys,average_volume,price_per_state,case_category,sol_criteria,created_at,updated_at',
        )
        .order('updated_at', { ascending: false });

      if (profileError) throw new Error(profileError.message);

      const profileRows = profiles ?? [];
      const userIds = profileRows.map((profile) => profile.user_id).filter(Boolean);
      let usersById: Record<string, AppUserRow> = {};

      if (userIds.length > 0) {
        const { data: users, error: usersError } = await brokerSupabase
          .from('app_users')
          .select('user_id,email,display_name,role,account_status,created_at,updated_at')
          .in('user_id', userIds);

        if (usersError) throw new Error(usersError.message);

        usersById = Object.fromEntries(
          (users ?? [])
            .filter((user) => user.user_id)
            .map((user) => [user.user_id, user]),
        );
      }

      setContacts(
        profileRows.map((profile) => ({
          profile,
          appUser: usersById[profile.user_id] ?? null,
        })),
      );

      if (showToast) {
        toast({
          title: 'Broker contacts refreshed',
          description: `${profileRows.length} broker profile${profileRows.length === 1 ? '' : 's'} loaded.`,
        });
      }
    } catch (error) {
      console.error('Error fetching broker contacts:', error);
      toast({
        title: 'Error fetching broker contacts',
        description: error instanceof Error ? error.message : 'Unable to load broker profiles.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchBrokerContacts();
  }, [fetchBrokerContacts]);

  const filteredContacts = useMemo(() => {
    const search = normalize(query);

    return contacts.filter((contact) => {
      const profile = contact.profile;
      const appUser = contact.appUser;
      const status = normalize(appUser?.account_status || 'active') || 'active';

      if (campaignFilter !== 'all' && profile.primary_campaign !== campaignFilter) return false;
      if (modelFilter !== 'all' && !(profile.active_models ?? []).includes(modelFilter)) return false;
      if (statusFilter !== 'all') {
        const isInactive = ['inactive', 'disabled', 'banned', 'suspended'].includes(status);
        if (statusFilter === 'active' && isInactive) return false;
        if (statusFilter === 'inactive' && !isInactive) return false;
      }

      if (!search) return true;

      const searchable = [
        profile.full_name,
        profile.company_name,
        profile.primary_email,
        profile.personal_email,
        appUser?.email,
        profile.direct_phone,
        profile.office_address,
        profile.website_url,
        profile.linkedin_username,
        profile.instagram_username,
        profile.facebook_username,
        profile.primary_campaign,
        profile.case_category,
        profile.sol_criteria,
        ...(profile.active_models ?? []),
        ...(profile.active_states ?? []),
      ];

      return searchable.some((value) => normalize(value).includes(search));
    });
  }, [campaignFilter, contacts, modelFilter, query, statusFilter]);

  const stats = useMemo(() => {
    const inactiveStatuses = new Set(['inactive', 'disabled', 'banned', 'suspended']);
    const active = contacts.filter((contact) => !inactiveStatuses.has(normalize(contact.appUser?.account_status))).length;
    const states = new Set(contacts.flatMap((contact) => contact.profile.active_states ?? []));
    const models = new Set(contacts.flatMap((contact) => contact.profile.active_models ?? []));

    return {
      total: contacts.length,
      active,
      states: states.size,
      models: models.size,
    };
  }, [contacts]);

  if (loading) {
    return <LogoLoader page label="Loading broker contacts..." />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Broker Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Broker profile contact details, active campaigns, coverage states, and volume defaults.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void fetchBrokerContacts(true)}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          Refresh
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Brokers</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{stats.total}</div>
            <Users className="h-7 w-7 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Brokers</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{stats.active}</div>
            <Building2 className="h-7 w-7 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active States</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{stats.states}</div>
            <MapPin className="h-7 w-7 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Models</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-2xl font-semibold">{stats.models}</div>
            <DollarSign className="h-7 w-7 text-primary" />
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,1fr)_180px_180px_180px]">
            <div className="space-y-2">
              <Label htmlFor="broker-contact-search">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="broker-contact-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, company, email, phone, campaign, state..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Campaign</Label>
              <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  {CAMPAIGN_OPTIONS.map((campaign) => (
                    <SelectItem key={campaign} value={campaign}>
                      {campaign}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={modelFilter} onValueChange={setModelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All models" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Models</SelectItem>
                  {CAMPAIGN_OPTIONS.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contacts ({filteredContacts.length})</h2>
      </div>

      {filteredContacts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No broker contacts found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredContacts.map((contact) => {
            const { profile, appUser } = contact;
            const displayName = getDisplayName(contact);
            const email = getPrimaryEmail(contact);
            const states = compactList(profile.active_states, 8);
            const models = compactList(profile.active_models, 4);
            const languages = compactList(profile.languages, 4);
            const website = withProtocol(profile.website_url);

            return (
              <Card key={profile.user_id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-semibold">{displayName}</h3>
                          <Badge variant="outline" className={statusBadgeClass(appUser?.account_status)}>
                            {formatStatus(appUser?.account_status)}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-4 w-4 shrink-0" />
                          <span className="truncate">{profile.company_name || 'No company on file'}</span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/broker-management', { state: { selectedUserId: profile.user_id } })}
                      >
                        View Profile
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{email || 'No email on file'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{profile.personal_email || 'No personal email on file'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{profile.direct_phone || 'No phone on file'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground md:col-span-2">
                        <MapPin className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{profile.office_address || 'No office address on file'}</span>
                      </div>
                      {website ? (
                        <a
                          href={website}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          <Globe2 className="h-4 w-4 shrink-0" />
                          <span className="truncate">{profile.website_url}</span>
                        </a>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Globe2 className="h-4 w-4 shrink-0 text-primary" />
                          <span>No website on file</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Linkedin className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{profile.linkedin_username || 'No LinkedIn username'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Instagram className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{profile.instagram_username || 'No Instagram username'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Facebook className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{profile.facebook_username || 'No Facebook username'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 border-t pt-4 text-sm md:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Active Models
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {models.visible.length > 0 ? (
                            <>
                              {models.visible.map((model) => (
                                <Badge key={model} variant="secondary">{model}</Badge>
                              ))}
                              {models.hiddenCount > 0 ? <Badge variant="outline">+{models.hiddenCount}</Badge> : null}
                            </>
                          ) : (
                            <span className="text-muted-foreground">None selected</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Active States
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {states.visible.length > 0 ? (
                            <>
                              {states.visible.map((state) => (
                                <Badge key={state} variant="outline">{state}</Badge>
                              ))}
                              {states.hiddenCount > 0 ? <Badge variant="outline">+{states.hiddenCount}</Badge> : null}
                            </>
                          ) : (
                            <span className="text-muted-foreground">None selected</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-t pt-4 text-sm md:grid-cols-4">
                      <div>
                        <div className="text-xs text-muted-foreground">Primary Campaign</div>
                        <div className="font-medium">{profile.primary_campaign || 'Not set'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Price / State</div>
                        <div className="font-medium">{formatCurrency(profile.price_per_state)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Attorneys</div>
                        <div className="font-medium">{formatNumber(profile.number_of_attorneys)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Avg. Volume</div>
                        <div className="font-medium">{formatNumber(profile.average_volume)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Years in Business</div>
                        <div className="font-medium">{formatNumber(profile.years_in_business)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Preferred Contact</div>
                        <div className="font-medium capitalize">{profile.preferred_contact || 'Not set'}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-muted-foreground">Languages</div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {languages.visible.length > 0 ? (
                            <>
                              {languages.visible.map((language) => (
                                <Badge key={language} variant="secondary">{language}</Badge>
                              ))}
                              {languages.hiddenCount > 0 ? <Badge variant="outline">+{languages.hiddenCount}</Badge> : null}
                            </>
                          ) : (
                            <span className="font-medium">Not set</span>
                          )}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-muted-foreground">Case Category</div>
                        <div className="font-medium">{profile.case_category || 'Not set'}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-muted-foreground">SOL Criteria</div>
                        <div className="font-medium">
                          {profile.sol_criteria === '6_12_months'
                            ? '6-12 months'
                            : profile.sol_criteria === '12_plus_months'
                              ? '12+ months'
                              : 'Not set'}
                        </div>
                      </div>
                      <div className="col-span-2 md:col-span-4">
                        <div className="text-xs text-muted-foreground">Bio</div>
                        <div className="line-clamp-3 font-medium">{profile.bio || 'Not set'}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BrokerContactsPage;
