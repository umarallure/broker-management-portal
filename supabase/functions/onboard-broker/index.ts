import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { z } from 'https://esm.sh/zod@3.24.1';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
];

type AuthedUser = {
  id: string;
  email: string | null;
};

const getEnv = (key: string, fallback?: string) => {
  const value = Deno.env.get(key)?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing env var: ${key}`);
};

const getAllowedOrigins = () => {
  const configured = Deno.env.get('ALLOWED_PORTAL_ORIGINS');
  if (!configured?.trim()) return DEFAULT_ALLOWED_ORIGINS;

  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const getAllowedRequestOrigin = (req: Request) => {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = req.headers.get('origin') ?? '';
  if (!requestOrigin) return null;
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : null;
};

const getCorsHeaders = (req: Request) => {
  const allowOrigin = getAllowedRequestOrigin(req);

  return {
    ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
};

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });

const getBearerToken = (req: Request) => {
  const auth = req.headers.get('authorization') ?? '';
  const [type, token] = auth.split(' ');
  if (type?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
};

const requireAuthenticatedUser = async (req: Request): Promise<{ user: AuthedUser } | { error: Response }> => {
  const supabaseUrl = getEnv('SUPABASE_URL');
  const anonKey = getEnv('SUPABASE_ANON_KEY');

  const token = getBearerToken(req);
  if (!token) return { error: json(req, { error: 'Missing Authorization header' }, 401) };

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) {
    return { error: json(req, { error: 'Invalid session' }, 401) };
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
    },
  };
};

const hasPortalAdminAccess = async (adminClient: ReturnType<typeof createClient>, userId: string) => {
  const { data: appUser, error: appUserError } = await adminClient
    .from('app_users')
    .select('role,is_super_admin')
    .eq('user_id', userId)
    .maybeSingle();

  if (appUserError) {
    throw new Error(appUserError.message);
  }

  if (appUser && (appUser.is_super_admin || appUser.role === 'super_admin' || appUser.role === 'admin')) {
    return true;
  }

  const { data: roleRow, error: roleError } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['admin', 'super_admin'])
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (roleError) {
    throw new Error(roleError.message);
  }

  return Boolean(roleRow?.role === 'admin' || roleRow?.role === 'super_admin');
};

const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const;

const US_STATE_CODE_SET = new Set<string>(US_STATE_CODES);
const LANGUAGE_VALUES = ['English', 'Spanish'] as const;
const LANGUAGE_VALUE_SET = new Set<string>(LANGUAGE_VALUES);
const MODEL_VALUES = ['CPL', 'CPQ', 'CPA', 'Retainer'] as const;
const MODEL_VALUE_SET = new Set<string>(MODEL_VALUES);
const POSITION_VALUES = ['accounting', 'marketing', 'invoicing', 'intake_team', 'other'] as const;
const POSITION_VALUE_SET = new Set<string>(POSITION_VALUES);
const CONTACT_VALUES = ['email', 'phone', 'text'] as const;
const CONTACT_VALUE_SET = new Set<string>(CONTACT_VALUES);
const CASE_CATEGORY_VALUES = ['Consumer Cases', 'Consumer and Commercial Cases'] as const;
const CASE_CATEGORY_VALUE_SET = new Set<string>(CASE_CATEGORY_VALUES);
const SOL_CRITERIA_VALUES = ['6_12_months', '12_plus_months'] as const;
const SOL_CRITERIA_VALUE_SET = new Set<string>(SOL_CRITERIA_VALUES);
const MIN_PRICE_PER_STATE = 2250;
const BROKER_SECTION_VALUES = [
  'dashboard',
  'order_map',
  'cases',
  'invoicing',
  'attorneys',
  'task_assignment',
  'settings',
] as const;
const BROKER_SECTION_VALUE_SET = new Set<string>(BROKER_SECTION_VALUES);

const DEFAULT_WEEKLY_AVAILABILITY = {
  monday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  tuesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  wednesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  thursday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  friday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  saturday: { enabled: false, slots: [] },
  sunday: { enabled: false, slots: [] },
};

const optionalTextSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  },
  z.string().optional(),
);

const optionalEmailSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return undefined;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : undefined;
  },
  z.string().optional(),
);

const requiredTextSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : ''),
  z.string().min(1),
);

const optionalNonNegativeIntSchema = z.preprocess(
  (value) => {
    if (typeof value === 'number') {
      return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const parsed = Number.parseInt(trimmed, 10);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
    }
    return undefined;
  },
  z.number().int().min(0).optional(),
);

const pricePerStateSchema = z.preprocess(
  (value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return Number(trimmed);
    }
    return undefined;
  },
  z.number().int().min(MIN_PRICE_PER_STATE, `Minimum price per state is $${MIN_PRICE_PER_STATE}`).default(MIN_PRICE_PER_STATE),
);

const optionalLanguageArraySchema = z.preprocess(
  (value) => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item): item is (typeof LANGUAGE_VALUES)[number] => LANGUAGE_VALUE_SET.has(item))));
  },
  z.array(z.string()).default([]),
);

const optionalModelArraySchema = z.preprocess(
  (value) => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item): item is (typeof MODEL_VALUES)[number] => MODEL_VALUE_SET.has(item))));
  },
  z.array(z.string()).max(4).default([]),
);

const optionalStateCodeArraySchema = z.preprocess(
  (value) => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value
      .map((item) => (typeof item === 'string' ? item.trim().toUpperCase() : ''))
      .filter((item) => US_STATE_CODE_SET.has(item))));
  },
  z.array(z.string()).max(50).default([]),
);

const optionalStateCodeSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().toUpperCase();
    return US_STATE_CODE_SET.has(trimmed) ? trimmed : undefined;
  },
  z.string().optional(),
);

const officeAddressSchema = z.preprocess(
  (value) => (value && typeof value === 'object' ? value : {}),
  z.object({
    street: optionalTextSchema,
    suite: optionalTextSchema,
    city: optionalTextSchema,
    state: optionalStateCodeSchema,
    zip: optionalTextSchema,
  }),
);

const brokerProfileSchema = z.preprocess(
  (value) => (value && typeof value === 'object' ? value : {}),
  z.object({
    fullName: optionalTextSchema,
    companyName: optionalTextSchema,
    bio: optionalTextSchema,
    yearsInBusiness: optionalNonNegativeIntSchema,
    languages: optionalLanguageArraySchema,
    primaryEmail: optionalEmailSchema,
    personalEmail: optionalEmailSchema,
    directPhone: optionalTextSchema,
    preferredContact: z.preprocess(
      (value) => {
        if (typeof value !== 'string') return undefined;
        const trimmed = value.trim();
        return CONTACT_VALUE_SET.has(trimmed) ? trimmed : undefined;
      },
      z.enum(CONTACT_VALUES).optional(),
    ),
    officeAddress: officeAddressSchema.optional().default({}),
    websiteUrl: optionalTextSchema,
    linkedinUsername: optionalTextSchema,
    instagramUsername: optionalTextSchema,
    facebookUsername: optionalTextSchema,
    activeModels: optionalModelArraySchema,
    activeStates: optionalStateCodeArraySchema,
    primaryCampaign: z.preprocess(
      (value) => {
        if (typeof value !== 'string') return undefined;
        const trimmed = value.trim();
        return MODEL_VALUE_SET.has(trimmed) ? trimmed : undefined;
      },
      z.enum(MODEL_VALUES).optional(),
    ),
    numberOfAttorneys: optionalNonNegativeIntSchema,
    averageVolume: optionalNonNegativeIntSchema,
    pricePerState: pricePerStateSchema,
    caseCategory: z.preprocess(
      (value) => {
        if (typeof value !== 'string') return undefined;
        const trimmed = value.trim();
        return CASE_CATEGORY_VALUE_SET.has(trimmed) ? trimmed : undefined;
      },
      z.enum(CASE_CATEGORY_VALUES).optional(),
    ),
    solCriteria: z.preprocess(
      (value) => {
        if (typeof value !== 'string') return undefined;
        const trimmed = value.trim();
        return SOL_CRITERIA_VALUE_SET.has(trimmed) ? trimmed : undefined;
      },
      z.enum(SOL_CRITERIA_VALUES).optional(),
    ),
  }).default({}),
);

const brokerMemberSchema = z.preprocess(
  (value) => (value && typeof value === 'object' ? value : {}),
  z.object({
    full_name: requiredTextSchema,
    email: z.string().email('Valid email required').transform((value) => value.toLowerCase().trim()),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    phone: optionalTextSchema,
    state: optionalStateCodeSchema,
    position: z.preprocess(
      (value) => {
        if (typeof value !== 'string') return undefined;
        const trimmed = value.trim();
        return POSITION_VALUE_SET.has(trimmed) ? trimmed : undefined;
      },
      z.enum(POSITION_VALUES),
    ),
    position_other: optionalTextSchema,
    shift_availability: optionalTextSchema,
    weekly_availability: z.unknown().optional().default(DEFAULT_WEEKLY_AVAILABILITY),
    holiday_hours: z.preprocess((value) => (Array.isArray(value) ? value : []), z.array(z.unknown()).default([])),
    allowed_sections: z.preprocess(
      (value) => {
        if (!Array.isArray(value)) return [];
        return Array.from(new Set(value
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item): item is (typeof BROKER_SECTION_VALUES)[number] => BROKER_SECTION_VALUE_SET.has(item))));
      },
      z.array(z.enum(BROKER_SECTION_VALUES)).min(1, 'Select at least one accessible section'),
    ),
  }).transform((member) => ({
    ...member,
    position_other: member.position === 'other' ? member.position_other : null,
    shift_availability: member.shift_availability || 'full_day',
  })),
);

const onboardingRequestSchema = z.object({
  account: z.object({
    email: z.string().email('Valid email required').transform((value) => value.toLowerCase().trim()),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
  brokerProfile: brokerProfileSchema,
  brokerMembers: z.preprocess(
    (value) => (Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []),
    z.array(brokerMemberSchema).default([]),
  ),
});

const rollbackAuthUser = async (
  admin: ReturnType<typeof createClient>,
  userId: string,
) => {
  try {
    await admin.from('app_users').delete().eq('user_id', userId);
  } catch (cleanupError) {
    console.error('[onboard-broker] app_users cleanup error:', cleanupError);
  }

  try {
    await admin.auth.admin.deleteUser(userId);
  } catch (cleanupError) {
    console.error('[onboard-broker] auth user cleanup error:', cleanupError);
  }
};

const buildOfficeAddressString = (addr: {
  street?: string;
  suite?: string;
  city?: string;
  state?: string;
  zip?: string;
}) => {
  const parts = [addr.street];
  if (addr.suite) parts.push(addr.suite);
  if (addr.city || addr.state || addr.zip) {
    parts.push(`${addr.city || ''}, ${addr.state || ''} ${addr.zip || ''}`.trim());
  }
  return parts.filter(Boolean).join(', ');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    if (req.headers.get('origin') && !getAllowedRequestOrigin(req)) {
      return new Response('Forbidden', { status: 403 });
    }
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return json(req, { error: 'Method not allowed' }, 405);
  }

  try {
    const authResult = await requireAuthenticatedUser(req);
    if ('error' in authResult) return authResult.error;

    const supabaseUrl = getEnv('SUPABASE_URL');
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const hasAccess = await hasPortalAdminAccess(admin, authResult.user.id);
    if (!hasAccess) {
      return json(req, { error: 'Admin access required' }, 403);
    }

    const payloadResult = onboardingRequestSchema.safeParse(await req.json().catch(() => ({})));

    if (!payloadResult.success) {
      const fieldErrors = Object.fromEntries(
        payloadResult.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
      );
      return json(req, { error: 'Validation failed', fieldErrors }, 400);
    }

    const { account, brokerProfile: profile, brokerMembers } = payloadResult.data;
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { display_name: profile.fullName ?? null },
    });

    if (authError || !authData.user) {
      return json(req, { error: authError?.message ?? 'Unable to create broker user', fieldErrors: { 'account.email': authError?.message ?? 'Unable to create broker user' } }, 400);
    }

    const brokerUserId = authData.user.id;

    const { error: appUserError } = await admin
      .from('app_users')
      .upsert(
        {
          user_id: brokerUserId,
          email: account.email,
          display_name: profile.fullName || null,
          role: 'broker',
          account_status: 'active',
          center_id: null,
        },
        { onConflict: 'user_id' },
      );

    if (appUserError) {
      console.error('[onboard-broker] app_users upsert error:', appUserError);
      await rollbackAuthUser(admin, brokerUserId);
      return json(req, { error: `Failed to create app_users record: ${appUserError.message}` }, 500);
    }

    const officeAddress = buildOfficeAddressString(profile.officeAddress || {});
    const profilePayload: Record<string, unknown> = {
      user_id: brokerUserId,
      full_name: profile.fullName || null,
      company_name: profile.companyName || null,
      bio: profile.bio || null,
      years_in_business: profile.yearsInBusiness ?? null,
      languages: profile.languages,
      primary_email: profile.primaryEmail || null,
      personal_email: profile.personalEmail || null,
      direct_phone: profile.directPhone || null,
      office_address: officeAddress || null,
      website_url: profile.websiteUrl || null,
      preferred_contact: profile.preferredContact || null,
      linkedin_username: profile.linkedinUsername || null,
      instagram_username: profile.instagramUsername || null,
      facebook_username: profile.facebookUsername || null,
      active_models: profile.activeModels,
      active_states: profile.activeStates,
      primary_campaign: profile.primaryCampaign || null,
      number_of_attorneys: profile.numberOfAttorneys ?? null,
      average_volume: profile.averageVolume ?? null,
      price_per_state: profile.pricePerState,
      case_category: profile.caseCategory || null,
      sol_criteria: profile.solCriteria || null,
    };

    const { error: profileError } = await admin
      .from('broker_profiles')
      .upsert(profilePayload, { onConflict: 'user_id' });

    if (profileError) {
      console.error('[onboard-broker] broker_profiles upsert error:', profileError);
      await rollbackAuthUser(admin, brokerUserId);
      return json(req, { error: `Failed to create broker profile: ${profileError.message}` }, 500);
    }

    const brokerMemberIds: string[] = [];
    const warnings: string[] = [];

    for (const [index, member] of brokerMembers.entries()) {
      const memberLabel = member.full_name || member.email || `Member ${index + 1}`;
      const createdMember = await admin.auth.admin.createUser({
        email: member.email,
        password: member.password,
        email_confirm: true,
        user_metadata: { display_name: member.full_name },
      });

      if (createdMember.error || !createdMember.data.user) {
        warnings.push(`${memberLabel} could not be created: ${createdMember.error?.message ?? 'Unable to create login'}`);
        continue;
      }

      const memberUserId = createdMember.data.user.id;

      try {
        const { error: memberAppUserError } = await admin
          .from('app_users')
          .upsert(
            {
              user_id: memberUserId,
              email: member.email,
              display_name: member.full_name,
              role: 'broker_member',
              account_status: 'active',
              center_id: null,
            },
            { onConflict: 'user_id' },
          );

        if (memberAppUserError) throw new Error(memberAppUserError.message);

        const { data: memberRow, error: memberInsertError } = await admin
          .from('broker_team_members')
          .insert({
            broker_id: brokerUserId,
            user_id: memberUserId,
            full_name: member.full_name,
            email: member.email,
            phone: member.phone || null,
            state: member.state || null,
            position: member.position,
            position_other: member.position === 'other' ? member.position_other || null : null,
            shift_availability: member.shift_availability || 'full_day',
            weekly_availability: member.weekly_availability || DEFAULT_WEEKLY_AVAILABILITY,
            holiday_hours: member.holiday_hours || [],
            allowed_sections: member.allowed_sections,
          })
          .select('id')
          .single();

        if (memberInsertError) throw new Error(memberInsertError.message);
        if (memberRow?.id) brokerMemberIds.push(String(memberRow.id));
      } catch (memberError) {
        await rollbackAuthUser(admin, memberUserId);
        warnings.push(`${memberLabel} could not be saved as a broker member: ${memberError instanceof Error ? memberError.message : 'Unknown error'}`);
      }
    }

    return json(req, {
      success: true,
      userId: brokerUserId,
      email: account.email,
      brokerMemberIds,
      warnings,
    });
  } catch (err) {
    console.error('[onboard-broker] unexpected error:', err);
    return json(req, { error: (err as Error).message || 'Internal server error' }, 500);
  }
});
