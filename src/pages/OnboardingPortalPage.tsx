import { useCallback, useState } from 'react';
import type React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  User,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { US_STATES } from '@/lib/us-states';
import {
  BROKER_MODEL_OPTIONS,
  BROKER_SECTION_OPTIONS,
  CASE_CATEGORY_OPTIONS,
  DEFAULT_WEEKLY_AVAILABILITY,
  LANGUAGE_OPTIONS,
  MIN_PRICE_PER_STATE,
  POSITION_OPTIONS,
  SOL_CRITERIA_OPTIONS,
  type BrokerMemberData,
  type BrokerSection,
  type WeeklyAvailability,
  deriveShiftAvailability,
  onboardingPayloadSchema,
} from '@/lib/onboarding-schema';

const STATE_CODE_OPTIONS = US_STATES.map((state) => ({ value: state.code, label: `${state.code} - ${state.name}` }));
const DASH_SELECT_TRIGGER_CLASS =
  'h-9 border-[var(--dash-border)] bg-background/80 text-[13px] text-[var(--dash-text)] backdrop-blur-sm focus:ring-[#AE4010]/30 hover:border-[var(--dash-border-hover)]';
const DASH_SELECT_CONTENT_CLASS =
  'border-[var(--dash-border)] bg-background/95 text-[var(--dash-text)] shadow-xl backdrop-blur-xl';
const DASH_MULTISELECT_CLASS =
  'border-[var(--dash-border)] bg-background/80 text-[13px] text-[var(--dash-text)] backdrop-blur-sm hover:border-[var(--dash-border-hover)]';
const DASH_MULTISELECT_COMPACT_CLASS = `${DASH_MULTISELECT_CLASS} min-h-9 h-9`;

const ALL_BROKER_SECTIONS = BROKER_SECTION_OPTIONS.map((section) => section.value);

function SectionCard({
  icon,
  title,
  children,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <div
      className="group/section dash-animate-in relative isolate overflow-hidden rounded-2xl border border-[#AE4010]/50 bg-[var(--dash-surface)] backdrop-blur-[var(--dash-blur)] shadow-[var(--dash-shadow)] transition-all duration-300 hover:border-[#AE4010]/65 hover:shadow-[0_14px_30px_rgba(174,64,16,0.14)] focus-within:border-[#AE4010]/75 focus-within:shadow-[0_16px_34px_rgba(174,64,16,0.18)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative flex items-center gap-3 border-b border-[#AE4010]/12 bg-[linear-gradient(90deg,rgba(174,64,16,0.18)_0%,rgba(174,64,16,0.1)_28%,rgba(174,64,16,0.04)_54%,rgba(174,64,16,0)_84%)] px-5 py-3.5">
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#AE4010] via-[#AE4010]/50 to-transparent" />
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#AE4010]/45 bg-[#AE4010]/10">
          <span className="text-[#AE4010]">{icon}</span>
        </div>
        <h2 className="text-[13px] font-semibold text-[var(--dash-text)]">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1 block text-[12px] font-medium text-[var(--dash-text)]">
      {children}
      {required ? <span className="ml-0.5 text-red-400">*</span> : null}
    </label>
  );
}

function FieldHelper({ children }: { children: React.ReactNode }) {
  return <p className="mt-0.5 text-[11px] text-[var(--dash-text-muted)]">{children}</p>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-0.5 text-[11px] text-red-400">{message}</p>;
}

function FormInput({
  label,
  required,
  helper,
  error,
  ...props
}: {
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <Input
        className="h-9 border-[var(--dash-border)] bg-transparent text-[13px] text-[var(--dash-text)] placeholder:text-[var(--dash-text-muted)]/50 focus:border-[#AE4010]/40 focus:ring-[#AE4010]/30"
        {...props}
      />
      {helper ? <FieldHelper>{helper}</FieldHelper> : null}
      <FieldError message={error} />
    </div>
  );
}

function ToggleGroup({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; activeColor: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(isActive ? '' : option.value)}
            className={`rounded-md border px-3 py-1.5 text-[11px] font-medium transition-all ${
              isActive
                ? `${option.activeColor} border-current`
                : 'border-[#AE4010]/20 text-[var(--dash-text-muted)] hover:bg-white/[0.03]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function StatusBanner({
  type,
  message,
}: {
  type: 'success' | 'error' | 'warning';
  message: string;
}) {
  const config = {
    success: { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400', icon: <CheckCircle2 className="h-4 w-4" /> },
    error: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', icon: <AlertTriangle className="h-4 w-4" /> },
    warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', icon: <AlertTriangle className="h-4 w-4" /> },
  }[type];

  return (
    <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 ${config.bg} ${config.border} ${config.text}`}>
      {config.icon}
      <span className="text-[12px] font-medium">{message}</span>
    </div>
  );
}

type BrokerMemberForm = Omit<BrokerMemberData, 'position_other'> & {
  position_other?: string | null;
  confirmPassword: string;
};

function blankBrokerMember(): BrokerMemberForm {
  return {
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    state: undefined,
    position: 'intake_team',
    position_other: '',
    weekly_availability: { ...DEFAULT_WEEKLY_AVAILABILITY },
    holiday_hours: [],
    shift_availability: 'full_day',
    allowed_sections: ['dashboard'],
  };
}

export default function OnboardingPortalPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [bio, setBio] = useState('');
  const [yearsInBusiness, setYearsInBusiness] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [activeModels, setActiveModels] = useState<string[]>([]);

  const [primaryEmail, setPrimaryEmail] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [directPhone, setDirectPhone] = useState('');
  const [preferredContact, setPreferredContact] = useState('');
  const [street, setStreet] = useState('');
  const [suite, setSuite] = useState('');
  const [city, setCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [zip, setZip] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [linkedinUsername, setLinkedinUsername] = useState('');
  const [instagramUsername, setInstagramUsername] = useState('');
  const [facebookUsername, setFacebookUsername] = useState('');

  const [activeStates, setActiveStates] = useState<string[]>([]);
  const [primaryCampaign, setPrimaryCampaign] = useState('');
  const [numberOfAttorneys, setNumberOfAttorneys] = useState('');
  const [averageVolume, setAverageVolume] = useState('');
  const [pricePerState, setPricePerState] = useState(String(MIN_PRICE_PER_STATE));
  const [caseCategory, setCaseCategory] = useState('');
  const [solCriteria, setSolCriteria] = useState('');

  const [brokerMembers, setBrokerMembers] = useState<BrokerMemberForm[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitWarnings, setSubmitWarnings] = useState<string[]>([]);

  const e = (key: string) => fieldErrors[key];

  const addBrokerMember = () => setBrokerMembers((current) => [...current, blankBrokerMember()]);
  const removeBrokerMember = (index: number) => setBrokerMembers((current) => current.filter((_, i) => i !== index));
  const updateBrokerMember = (index: number, field: keyof BrokerMemberForm, value: unknown) => {
    setBrokerMembers((current) => current.map((member, i) => (i === index ? { ...member, [field]: value } : member)));
  };

  const toggleBrokerMemberSection = (index: number, section: BrokerSection) => {
    setBrokerMembers((current) =>
      current.map((member, i) => {
        if (i !== index) return member;
        const selected = member.allowed_sections ?? [];
        return {
          ...member,
          allowed_sections: selected.includes(section)
            ? selected.filter((value) => value !== section)
            : [...selected, section],
        };
      }),
    );
  };

  const setBrokerMemberSections = (index: number, sections: BrokerSection[]) => {
    setBrokerMembers((current) => current.map((member, i) => (i === index ? { ...member, allowed_sections: sections } : member)));
  };

  const handleSubmit = useCallback(async () => {
    setFieldErrors({});
    setSubmitResult(null);
    setSubmitWarnings([]);

    const payloadResult = onboardingPayloadSchema.safeParse({
      account: { email, password, confirmPassword },
      brokerProfile: {
        fullName,
        companyName,
        bio,
        yearsInBusiness,
        languages,
        primaryEmail,
        personalEmail,
        directPhone,
        preferredContact: preferredContact || undefined,
        officeAddress: { street, suite, city, state: addressState, zip },
        websiteUrl,
        linkedinUsername,
        instagramUsername,
        facebookUsername,
        activeModels,
        activeStates,
        primaryCampaign: primaryCampaign || undefined,
        numberOfAttorneys,
        averageVolume,
        pricePerState,
        caseCategory: caseCategory || undefined,
        solCriteria: solCriteria || undefined,
      },
      brokerMembers: brokerMembers.map((member) => ({
        ...member,
        position_other: member.position === 'other' ? member.position_other || undefined : undefined,
        shift_availability: deriveShiftAvailability(member.weekly_availability as WeeklyAvailability),
      })),
    });

    if (!payloadResult.success) {
      const errors: Record<string, string> = {};
      payloadResult.error.issues.forEach((issue) => {
        errors[issue.path.join('.')] = issue.message;
      });
      setFieldErrors(errors);
      setSubmitResult({ type: 'error', message: Object.values(errors).join(', ') || 'Validation failed' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);

    try {
      const payload = payloadResult.data;
      const { data, error: fnError } = await supabase.functions.invoke('onboard-broker', {
        method: 'POST',
        body: {
          account: {
            email: payload.account.email,
            password: payload.account.password,
          },
          brokerProfile: payload.brokerProfile,
          brokerMembers: payload.brokerMembers.map((member) => ({
            ...member,
            confirmPassword: undefined,
          })),
        },
      });

      if (fnError) {
        setSubmitResult({ type: 'error', message: fnError.message || 'Failed to create broker account' });
        if (data?.fieldErrors) setFieldErrors(data.fieldErrors);
        return;
      }

      if (data?.error) {
        setSubmitResult({ type: 'error', message: data.error });
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        return;
      }

      const warnings = Array.isArray(data?.warnings)
        ? data.warnings.filter((warning): warning is string => typeof warning === 'string' && warning.trim().length > 0)
        : [];
      const createdEmail = payload.account.email;
      const displayName = (payload.brokerProfile?.fullName || '').trim();

      setSubmitWarnings(warnings);
      setSubmitResult({
        type: 'success',
        message: warnings.length > 0
          ? `Broker account created successfully for ${createdEmail}. Review the notes below.`
          : `Broker account created successfully for ${createdEmail}`,
      });

      toast({
        title: warnings.length > 0 ? 'Broker Created With Notes' : 'Broker Created',
        description: warnings.length > 0
          ? warnings[0]
          : displayName
            ? `${displayName} (${createdEmail}) has been onboarded.`
            : `${createdEmail} has been onboarded.`,
      });

      if (data?.userId && warnings.length === 0) {
        setTimeout(() => {
          navigate('/broker-management', {
            state: { selectedUserId: data.userId },
          });
        }, 1200);
      }
    } catch (err) {
      setSubmitResult({ type: 'error', message: (err as Error).message || 'Unexpected error' });
    } finally {
      setSubmitting(false);
    }
  }, [
    email,
    password,
    confirmPassword,
    fullName,
    companyName,
    bio,
    yearsInBusiness,
    languages,
    primaryEmail,
    personalEmail,
    directPhone,
    preferredContact,
    street,
    suite,
    city,
    addressState,
    zip,
    websiteUrl,
    linkedinUsername,
    instagramUsername,
    facebookUsername,
    activeModels,
    activeStates,
    primaryCampaign,
    numberOfAttorneys,
    averageVolume,
    pricePerState,
    caseCategory,
    solCriteria,
    brokerMembers,
    toast,
    navigate,
  ]);

  return (
    <div className="dashboard-premium min-h-full px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[900px] space-y-5">
        <div className="dash-animate-in">
          <h1 className="text-lg font-bold text-[var(--dash-text)]">New Broker Onboarding</h1>
          <p className="mt-0.5 text-[12px] text-[var(--dash-text-muted)]">
            Only Account Credentials are required for the broker. Profile details and broker members can be added now or later.
          </p>
        </div>

        {submitResult ? <StatusBanner type={submitResult.type} message={submitResult.message} /> : null}
        {submitWarnings.length > 0 ? (
          <div className="space-y-2">
            {submitWarnings.map((warning, index) => (
              <StatusBanner key={`submit-warning-${index}`} type="warning" message={warning} />
            ))}
          </div>
        ) : null}

        <SectionCard icon={<User className="h-3.5 w-3.5" />} title="Account Credentials" delay={60}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormInput
              label="Broker Email Address"
              required
              type="email"
              placeholder="broker@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={e('account.email')}
            />
            <div />
            <div>
              <FieldLabel required>Password</FieldLabel>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-9 border-[var(--dash-border)] bg-transparent pr-10 text-[13px] text-[var(--dash-text)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <FieldError message={e('account.password')} />
            </div>
            <FormInput
              label="Confirm Password"
              required
              type={showPassword ? 'text' : 'password'}
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              error={e('account.confirmPassword')}
            />
          </div>

          <div className="mt-5 border-t border-[var(--dash-border)] pt-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <FieldLabel>Broker Members</FieldLabel>
                <FieldHelper>Optional credentialed broker_member accounts attached to this broker.</FieldHelper>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addBrokerMember}
                className="border-[#AE4010]/30 text-[#AE4010] hover:bg-[#AE4010]/10"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Member
              </Button>
            </div>

            {brokerMembers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--dash-border)] px-4 py-6 text-center text-[12px] text-[var(--dash-text-muted)]">
                No broker members added yet.
              </div>
            ) : (
              <div className="space-y-4">
                {brokerMembers.map((member, index) => (
                  <div key={index} className="rounded-lg border border-[var(--dash-border)] bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--dash-text-muted)]">
                        Broker Member {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBrokerMember(index)}
                        className="text-[var(--dash-text-muted)] transition-colors hover:text-red-400"
                        aria-label={`Remove broker member ${index + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormInput
                        label="Full Name"
                        required
                        placeholder="Jane Smith"
                        value={member.full_name}
                        onChange={(event) => updateBrokerMember(index, 'full_name', event.target.value)}
                        error={e(`brokerMembers.${index}.full_name`)}
                      />
                      <FormInput
                        label="Email"
                        required
                        type="email"
                        placeholder="jane@company.com"
                        value={member.email}
                        onChange={(event) => updateBrokerMember(index, 'email', event.target.value)}
                        error={e(`brokerMembers.${index}.email`)}
                      />
                      <FormInput
                        label="Password"
                        required
                        type="password"
                        placeholder="Minimum 8 characters"
                        value={member.password}
                        onChange={(event) => updateBrokerMember(index, 'password', event.target.value)}
                        error={e(`brokerMembers.${index}.password`)}
                      />
                      <FormInput
                        label="Confirm Password"
                        required
                        type="password"
                        placeholder="Repeat password"
                        value={member.confirmPassword}
                        onChange={(event) => updateBrokerMember(index, 'confirmPassword', event.target.value)}
                        error={e(`brokerMembers.${index}.confirmPassword`)}
                      />
                      <FormInput
                        label="Phone"
                        type="tel"
                        placeholder="(555) 000-0000"
                        value={member.phone || ''}
                        onChange={(event) => updateBrokerMember(index, 'phone', event.target.value)}
                      />
                      <div>
                        <FieldLabel>State</FieldLabel>
                        <Select value={member.state || ''} onValueChange={(value) => updateBrokerMember(index, 'state', value)}>
                          <SelectTrigger className={DASH_SELECT_TRIGGER_CLASS}>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent className={DASH_SELECT_CONTENT_CLASS}>
                            {US_STATES.map((state) => (
                              <SelectItem key={state.code} value={state.code}>{state.code} - {state.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <FieldLabel required>Position</FieldLabel>
                        <Select value={member.position} onValueChange={(value) => updateBrokerMember(index, 'position', value)}>
                          <SelectTrigger className={DASH_SELECT_TRIGGER_CLASS}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className={DASH_SELECT_CONTENT_CLASS}>
                            {POSITION_OPTIONS.map((position) => (
                              <SelectItem key={position.value} value={position.value}>{position.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError message={e(`brokerMembers.${index}.position`)} />
                      </div>
                      {member.position === 'other' ? (
                        <FormInput
                          label="Specify Position"
                          required
                          placeholder="Operations"
                          value={member.position_other || ''}
                          onChange={(event) => updateBrokerMember(index, 'position_other', event.target.value)}
                          error={e(`brokerMembers.${index}.position_other`)}
                        />
                      ) : null}
                    </div>

                    <div className="mt-4 border-t border-[var(--dash-border)] pt-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <FieldLabel required>Allowed Sections</FieldLabel>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="text-[11px] font-medium text-[#AE4010] hover:text-[#E8622A]"
                            onClick={() => setBrokerMemberSections(index, [...ALL_BROKER_SECTIONS])}
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            className="text-[11px] font-medium text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]"
                            onClick={() => setBrokerMemberSections(index, [])}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {BROKER_SECTION_OPTIONS.map((section) => (
                          <label
                            key={section.value}
                            className="flex items-center gap-2 rounded-md border border-[var(--dash-border)] bg-background/40 px-3 py-2 text-[12px] text-[var(--dash-text)]"
                          >
                            <Checkbox
                              checked={(member.allowed_sections ?? []).includes(section.value)}
                              onCheckedChange={() => toggleBrokerMemberSection(index, section.value)}
                            />
                            <span>{section.label}</span>
                          </label>
                        ))}
                      </div>
                      <FieldError message={e(`brokerMembers.${index}.allowed_sections`)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard icon={<Building2 className="h-3.5 w-3.5" />} title="Account & Identity" delay={120}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormInput
              label="Full Name"
              placeholder="John Doe"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              error={e('brokerProfile.fullName')}
            />
            <FormInput
              label="Company Name"
              placeholder="Brokerage LLC"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              error={e('brokerProfile.companyName')}
            />
            <FormInput
              label="Years in Business"
              type="number"
              min={0}
              placeholder="5"
              value={yearsInBusiness}
              onChange={(event) => setYearsInBusiness(event.target.value)}
            />
            <div>
              <FieldLabel>Languages</FieldLabel>
              <MultiSelect
                options={LANGUAGE_OPTIONS}
                selected={languages}
                onChange={setLanguages}
                placeholder="Select languages"
                className={DASH_MULTISELECT_COMPACT_CLASS}
                showSelectAll={false}
              />
            </div>
          </div>
          <div className="mt-3">
            <FieldLabel>Bio</FieldLabel>
            <Textarea
              placeholder="Brief broker bio..."
              className="min-h-[72px] border-[var(--dash-border)] bg-transparent text-[13px] text-[var(--dash-text)] placeholder:text-[var(--dash-text-muted)]/50 focus:ring-[#AE4010]/30"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
          </div>

          <div className="mt-4 border-t border-[var(--dash-border)] pt-4">
            <FieldLabel>Active Models</FieldLabel>
            <MultiSelect
              options={BROKER_MODEL_OPTIONS}
              selected={activeModels}
              onChange={setActiveModels}
              placeholder="Select models"
              className={DASH_MULTISELECT_CLASS}
              showSelectAll={false}
            />
          </div>
        </SectionCard>

        <SectionCard icon={<MapPin className="h-3.5 w-3.5" />} title="Contact Details" delay={180}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormInput label="Primary Email" type="email" placeholder="contact@company.com" value={primaryEmail} onChange={(event) => setPrimaryEmail(event.target.value)} />
            <FormInput label="Personal Email" type="email" placeholder="name@example.com" value={personalEmail} onChange={(event) => setPersonalEmail(event.target.value)} />
            <FormInput label="Direct Phone" type="tel" placeholder="(555) 000-0000" value={directPhone} onChange={(event) => setDirectPhone(event.target.value)} />
            <div>
              <FieldLabel>Preferred Contact</FieldLabel>
              <ToggleGroup
                value={preferredContact}
                onChange={setPreferredContact}
                options={[
                  { value: 'email', label: 'Email', activeColor: 'bg-green-500/15 text-green-400' },
                  { value: 'phone', label: 'Phone', activeColor: 'bg-green-500/15 text-green-400' },
                  { value: 'text', label: 'Text', activeColor: 'bg-green-500/15 text-green-400' },
                ]}
              />
            </div>
          </div>

          <div className="mt-4 border-t border-[var(--dash-border)] pt-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--dash-text-muted)]">Office Address</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormInput label="Street Address" placeholder="123 Main St" value={street} onChange={(event) => setStreet(event.target.value)} />
              <FormInput label="Suite / Unit" placeholder="Suite 200" value={suite} onChange={(event) => setSuite(event.target.value)} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <FormInput label="City" placeholder="Miami" value={city} onChange={(event) => setCity(event.target.value)} />
              <div>
                <FieldLabel>State</FieldLabel>
                <Select value={addressState} onValueChange={setAddressState}>
                  <SelectTrigger className={DASH_SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className={DASH_SELECT_CONTENT_CLASS}>
                    {US_STATES.map((state) => (
                      <SelectItem key={state.code} value={state.code}>{state.code} - {state.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FormInput label="ZIP Code" placeholder="33101" value={zip} onChange={(event) => setZip(event.target.value)} />
            </div>
          </div>

          <div className="mt-4 border-t border-[var(--dash-border)] pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormInput label="Website URL" type="url" placeholder="https://www.company.com" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} />
              <FormInput label="LinkedIn Username" placeholder="company-name" value={linkedinUsername} onChange={(event) => setLinkedinUsername(event.target.value)} />
              <FormInput label="Instagram Username" placeholder="companyname" value={instagramUsername} onChange={(event) => setInstagramUsername(event.target.value)} />
              <FormInput label="Facebook Username" placeholder="companyname" value={facebookUsername} onChange={(event) => setFacebookUsername(event.target.value)} />
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={<Users className="h-3.5 w-3.5" />} title="Expertise & Jurisdiction" delay={240}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <FieldLabel>Active States</FieldLabel>
              <FieldHelper>Maximum 50 states</FieldHelper>
              <MultiSelect
                options={STATE_CODE_OPTIONS}
                selected={activeStates}
                onChange={(value) => setActiveStates(value.slice(0, 50))}
                placeholder="Select states"
                className={DASH_MULTISELECT_COMPACT_CLASS}
                showSelectAll
              />
            </div>
            <div>
              <FieldLabel>Primary Campaign</FieldLabel>
              <FieldHelper>Select one active model</FieldHelper>
              <Select value={primaryCampaign} onValueChange={setPrimaryCampaign}>
                <SelectTrigger className={DASH_SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="Select campaign" />
                </SelectTrigger>
                <SelectContent className={DASH_SELECT_CONTENT_CLASS}>
                  {BROKER_MODEL_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FormInput
              label="Number of Attorneys"
              type="number"
              min={0}
              placeholder="25"
              value={numberOfAttorneys}
              onChange={(event) => setNumberOfAttorneys(event.target.value)}
            />
            <FormInput
              label="Average Volume"
              type="number"
              min={0}
              placeholder="100"
              value={averageVolume}
              onChange={(event) => setAverageVolume(event.target.value)}
            />
            <FormInput
              label="Price per State"
              type="number"
              min={MIN_PRICE_PER_STATE}
              step={1}
              placeholder={String(MIN_PRICE_PER_STATE)}
              value={pricePerState}
              onChange={(event) => setPricePerState(event.target.value)}
              helper={`Minimum $${MIN_PRICE_PER_STATE.toLocaleString()}`}
              error={e('brokerProfile.pricePerState')}
            />
            <div>
              <FieldLabel>Case Category</FieldLabel>
              <Select value={caseCategory} onValueChange={setCaseCategory}>
                <SelectTrigger className={DASH_SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className={DASH_SELECT_CONTENT_CLASS}>
                  {CASE_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel>SOL Criteria</FieldLabel>
              <Select value={solCriteria} onValueChange={setSolCriteria}>
                <SelectTrigger className={DASH_SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="Select criteria" />
                </SelectTrigger>
                <SelectContent className={DASH_SELECT_CONTENT_CLASS}>
                  {SOL_CRITERIA_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionCard>

        <div className="dash-animate-in" style={{ animationDelay: '300ms' }}>
          <div className="overflow-hidden rounded-2xl border border-amber-500/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.08)_0%,rgba(245,158,11,0.04)_100%)] shadow-[0_10px_24px_rgba(120,53,15,0.08)] backdrop-blur-sm">
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              </div>
              <div className="space-y-2">
                <span className="block text-[12px] font-semibold text-amber-200">Important Notes</span>
                <p className="text-[12px] leading-5 text-amber-100/85">
                  This creates a real user account with <Badge variant="outline" className="mx-1 border-amber-500/30 text-amber-200">broker</Badge> role access.
                </p>
                <p className="text-[12px] leading-5 text-amber-100/80">
                  Broker members are created as credentialed <Badge variant="outline" className="mx-1 border-amber-500/30 text-amber-200">broker_member</Badge> users and attached to this broker workspace.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="dash-animate-in flex justify-end gap-3 pb-8" style={{ animationDelay: '360ms' }}>
          <Button
            variant="outline"
            className="border-[var(--dash-border)] text-[var(--dash-text-muted)] hover:bg-white/[0.03]"
            onClick={() => navigate(-1)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#AE4010] text-white hover:bg-[#7c2c0a] disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Broker...
              </>
            ) : (
              'Create Broker Account'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
