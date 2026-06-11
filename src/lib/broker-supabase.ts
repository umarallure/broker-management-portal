import { supabase } from '@/integrations/supabase/client';

export type AppUserRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string | null;
  account_status?: string | null;
  created_at: string;
  updated_at: string;
};

export type BrokerProfileRow = {
  user_id: string;
  full_name: string | null;
  company_name: string | null;
  bio: string | null;
  years_in_business: number | null;
  languages: string[] | null;
  primary_email: string | null;
  personal_email: string | null;
  direct_phone: string | null;
  office_address: string | null;
  website_url: string | null;
  preferred_contact: string | null;
  linkedin_username: string | null;
  instagram_username: string | null;
  facebook_username: string | null;
  active_models: string[] | null;
  active_states: string[] | null;
  primary_campaign: string | null;
  number_of_attorneys: number | null;
  average_volume: number | null;
  price_per_state: number | null;
  case_category: string | null;
  sol_criteria: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type BrokerTeamMemberRow = {
  id: string;
  broker_id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  state: string | null;
  position: string;
  position_other: string | null;
  allowed_sections: string[];
  created_at: string;
  updated_at?: string | null;
};

type SupabaseError = {
  message: string;
};

type SupabaseResult<T> = {
  data: T | null;
  error: SupabaseError | null;
  count?: number | null;
};

type QueryOptions = {
  count?: 'exact' | 'planned' | 'estimated';
  foreignTable?: string;
  head?: boolean;
  onConflict?: string;
  referencedTable?: string;
};

type OrderOptions = {
  ascending?: boolean;
  foreignTable?: string;
  nullsFirst?: boolean;
  referencedTable?: string;
};

type QueryBuilder<Row, Result = Row[]> = PromiseLike<SupabaseResult<Result>> & {
  select(columns?: string, options?: QueryOptions): QueryBuilder<Row, Row[]>;
  eq(column: string, value: unknown): QueryBuilder<Row, Result>;
  in(column: string, values: readonly unknown[]): QueryBuilder<Row, Result>;
  order(column: string, options?: OrderOptions): QueryBuilder<Row, Result>;
  maybeSingle(): Promise<SupabaseResult<Row>>;
  single(): Promise<SupabaseResult<Row>>;
  update(values: Partial<Row>): QueryBuilder<Row, Row[]>;
  upsert(values: Partial<Row> | Partial<Row>[], options?: QueryOptions): QueryBuilder<Row, Row[]>;
  insert(values: Partial<Row> | Partial<Row>[], options?: QueryOptions): QueryBuilder<Row, Row[]>;
};

type BrokerTableMap = {
  app_users: AppUserRow;
  broker_profiles: BrokerProfileRow;
  broker_team_members: BrokerTeamMemberRow;
};

type BrokerSupabaseClient = {
  from<TableName extends keyof BrokerTableMap>(
    table: TableName,
  ): QueryBuilder<BrokerTableMap[TableName]>;
};

export const brokerSupabase = supabase as unknown as BrokerSupabaseClient;
