import { z } from 'zod';

const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const;

export type USStateCode = (typeof US_STATE_CODES)[number];

const US_STATE_CODE_SET = new Set<string>(US_STATE_CODES);
const LANGUAGE_VALUES = ['English', 'Spanish'] as const;
const LANGUAGE_VALUE_SET = new Set<string>(LANGUAGE_VALUES);
const MODEL_VALUES = ['CPL', 'CPQ', 'CPA', 'Retainer'] as const;
const MODEL_VALUE_SET = new Set<string>(MODEL_VALUES);
const CASE_CATEGORY_VALUES = ['Consumer Cases', 'Consumer and Commercial Cases'] as const;
const CASE_CATEGORY_VALUE_SET = new Set<string>(CASE_CATEGORY_VALUES);
const SOL_CRITERIA_VALUES = ['6_12_months', '12_plus_months'] as const;
const SOL_CRITERIA_VALUE_SET = new Set<string>(SOL_CRITERIA_VALUES);
const POSITION_VALUES = ['accounting', 'marketing', 'invoicing', 'intake_team', 'other'] as const;
const SECTION_VALUES = ['dashboard', 'order_map', 'cases', 'invoicing', 'attorneys', 'task_assignment', 'settings'] as const;
const SECTION_VALUE_SET = new Set<string>(SECTION_VALUES);

export const MIN_PRICE_PER_STATE = 2250;

const timeSlotSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
  end: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
}).refine((slot) => slot.end > slot.start, { message: 'End must be after start' });

const dayAvailabilitySchema = z.object({
  enabled: z.boolean(),
  slots: z.array(timeSlotSchema),
});

const weeklyAvailabilitySchema = z.object({
  monday: dayAvailabilitySchema,
  tuesday: dayAvailabilitySchema,
  wednesday: dayAvailabilitySchema,
  thursday: dayAvailabilitySchema,
  friday: dayAvailabilitySchema,
  saturday: dayAvailabilitySchema,
  sunday: dayAvailabilitySchema,
});

const holidayHoursSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  label: z.string().nullable(),
  is_closed: z.boolean(),
  slots: z.array(timeSlotSchema),
});

const DEFAULT_WEEKLY_AVAILABILITY_VALUE = {
  monday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  tuesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  wednesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  thursday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  friday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  saturday: { enabled: false, slots: [] },
  sunday: { enabled: false, slots: [] },
} satisfies z.input<typeof weeklyAvailabilitySchema>;

const optionalTextSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  },
  z.string().optional(),
);

const requiredTextSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : ''),
  z.string().min(1, 'Required'),
);

const optionalEmailSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().toLowerCase();
    return trimmed === '' ? undefined : trimmed;
  },
  z.string().email('Valid email required').catch(undefined),
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
  z.array(z.enum(LANGUAGE_VALUES)).default([]),
);

const optionalModelArraySchema = z.preprocess(
  (value) => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item): item is (typeof MODEL_VALUES)[number] => MODEL_VALUE_SET.has(item))));
  },
  z.array(z.enum(MODEL_VALUES)).max(4).default([]),
);

const optionalStateCodeArraySchema = z.preprocess(
  (value) => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value
      .map((item) => (typeof item === 'string' ? item.trim().toUpperCase() : ''))
      .filter((item): item is USStateCode => US_STATE_CODE_SET.has(item))));
  },
  z.array(z.enum(US_STATE_CODES)).max(50).default([]),
);

const optionalStateCodeSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().toUpperCase();
    return US_STATE_CODE_SET.has(trimmed) ? trimmed : undefined;
  },
  z.enum(US_STATE_CODES).optional(),
);

const optionalBrokerSectionArraySchema = z.preprocess(
  (value) => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item): item is (typeof SECTION_VALUES)[number] => SECTION_VALUE_SET.has(item))));
  },
  z.array(z.enum(SECTION_VALUES)).min(1, 'Select at least one accessible section'),
);

const officeAddressSchema = z.object({
  street: z.string().optional().default(''),
  suite: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: optionalStateCodeSchema,
  zip: z.string().optional().default(''),
});

export const accountSchema = z.object({
  email: z.string().email('Valid email required').transform((value) => value.toLowerCase().trim()),
  password: z.string().min(8, 'Minimum 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword'],
});

export const brokerProfileSchema = z.object({
  fullName: optionalTextSchema,
  companyName: optionalTextSchema,
  bio: optionalTextSchema,
  yearsInBusiness: optionalNonNegativeIntSchema,
  languages: optionalLanguageArraySchema,
  primaryEmail: optionalEmailSchema,
  personalEmail: optionalEmailSchema,
  directPhone: optionalTextSchema,
  preferredContact: z.enum(['email', 'phone', 'text']).optional(),
  officeAddress: officeAddressSchema.optional().default({}),
  websiteUrl: optionalTextSchema,
  linkedinUsername: optionalTextSchema,
  instagramUsername: optionalTextSchema,
  facebookUsername: optionalTextSchema,
  activeModels: optionalModelArraySchema,
  activeStates: optionalStateCodeArraySchema,
  primaryCampaign: z.enum(MODEL_VALUES).optional(),
  numberOfAttorneys: optionalNonNegativeIntSchema,
  averageVolume: optionalNonNegativeIntSchema,
  pricePerState: pricePerStateSchema,
  caseCategory: z.enum(CASE_CATEGORY_VALUES).optional(),
  solCriteria: z.enum(SOL_CRITERIA_VALUES).optional(),
});

export const brokerMemberSchema = z.object({
  full_name: requiredTextSchema,
  email: z.string().email('Valid email required').transform((value) => value.toLowerCase().trim()),
  password: z.string().min(8, 'Minimum 8 characters'),
  confirmPassword: z.string(),
  phone: optionalTextSchema,
  state: optionalStateCodeSchema,
  position: z.enum(POSITION_VALUES),
  position_other: optionalTextSchema,
  weekly_availability: weeklyAvailabilitySchema.optional().default(DEFAULT_WEEKLY_AVAILABILITY_VALUE),
  holiday_hours: z.array(holidayHoursSchema).optional().default([]),
  shift_availability: optionalTextSchema,
  allowed_sections: optionalBrokerSectionArraySchema,
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword'],
}).refine((data) => data.position !== 'other' || Boolean(data.position_other?.trim()), {
  message: 'Specify the team member position',
  path: ['position_other'],
}).transform((data) => ({
  ...data,
  position_other: data.position === 'other' ? data.position_other : null,
}));

export const onboardingPayloadSchema = z.object({
  account: accountSchema,
  brokerProfile: brokerProfileSchema.optional().default({}),
  brokerMembers: z.array(brokerMemberSchema).optional().default([]),
});

export type OnboardingPayload = z.infer<typeof onboardingPayloadSchema>;
export type AccountData = z.infer<typeof accountSchema>;
export type BrokerProfileData = z.infer<typeof brokerProfileSchema>;
export type BrokerMemberData = z.infer<typeof brokerMemberSchema>;
export type OfficeAddress = z.infer<typeof officeAddressSchema>;
export type WeeklyAvailability = z.infer<typeof weeklyAvailabilitySchema>;
export type BrokerSection = (typeof SECTION_VALUES)[number];
export type BrokerModel = (typeof MODEL_VALUES)[number];

export const DEFAULT_WEEKLY_AVAILABILITY: WeeklyAvailability = DEFAULT_WEEKLY_AVAILABILITY_VALUE;

export const BROKER_MODEL_OPTIONS = [...MODEL_VALUES];
export const LANGUAGE_OPTIONS = [...LANGUAGE_VALUES];
export const CASE_CATEGORY_OPTIONS = [...CASE_CATEGORY_VALUES];
export const SOL_CRITERIA_OPTIONS = [
  { value: '6_12_months', label: '6-12 months' },
  { value: '12_plus_months', label: '12+ months' },
] as const;

export const BROKER_SECTION_OPTIONS: Array<{ value: BrokerSection; label: string }> = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'order_map', label: 'Order Map' },
  { value: 'cases', label: 'Cases' },
  { value: 'invoicing', label: 'Invoicing' },
  { value: 'attorneys', label: 'Network' },
  { value: 'task_assignment', label: 'Task Assignment' },
  { value: 'settings', label: 'Settings' },
];

export const POSITION_OPTIONS = [
  { value: 'accounting', label: 'Accounting' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'invoicing', label: 'Invoicing' },
  { value: 'intake_team', label: 'Intake Team' },
  { value: 'other', label: 'Other' },
] as const;

export function buildOfficeAddressString(addr: OfficeAddress): string {
  const parts = [addr.street];
  if (addr.suite) parts.push(addr.suite);
  if (addr.city || addr.state || addr.zip) {
    parts.push(`${addr.city || ''}, ${addr.state || ''} ${addr.zip || ''}`.trim());
  }
  return parts.filter(Boolean).join(', ');
}

export function deriveShiftAvailability(avail: WeeklyAvailability): string {
  const enabledDays = Object.values(avail).filter((day) => day.enabled);
  if (enabledDays.length === 0) return 'full_day';
  const allSlots = enabledDays.flatMap((day) => day.slots);
  if (allSlots.length === 0) return 'full_day';
  const avgStart = allSlots.reduce((sum, slot) => sum + parseInt(slot.start.split(':')[0], 10), 0) / allSlots.length;
  const avgEnd = allSlots.reduce((sum, slot) => sum + parseInt(slot.end.split(':')[0], 10), 0) / allSlots.length;
  if (avgEnd <= 12) return 'morning';
  if (avgStart >= 12 && avgEnd <= 18) return 'afternoon';
  if (avgStart >= 17) return 'evening';
  return 'full_day';
}
