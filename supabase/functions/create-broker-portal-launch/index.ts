import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'https://brokeronboarding.accidentpayments.com',
  'https://broker.accidentpayments.com',
]

type AppUserRole = 'super_admin' | 'admin' | 'lawyer' | 'agent' | 'broker' | 'broker_member'

type AuthedUser = {
  id: string
  email: string | null
}

type AppUserLookup = {
  user_id: string
  email: string | null
  display_name: string | null
  role: AppUserRole | null
  is_super_admin?: boolean | null
  account_status?: string | null
}

const getEnv = (key: string, fallback?: string) => {
  const value = Deno.env.get(key)?.trim()
  if (value) return value
  if (fallback !== undefined) return fallback
  throw new Error(`Missing env var: ${key}`)
}

const getAllowedOrigins = () => {
  const configured = Deno.env.get('ALLOWED_PORTAL_ORIGINS')
  if (!configured?.trim()) return DEFAULT_ALLOWED_ORIGINS

  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

const getAllowedRequestOrigin = (req: Request) => {
  const allowedOrigins = getAllowedOrigins()
  const requestOrigin = req.headers.get('origin') ?? ''
  if (!requestOrigin) return null
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : null
}

const getCorsHeaders = (req: Request) => {
  const allowOrigin = getAllowedRequestOrigin(req)

  return {
    ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'application/json',
    },
  })

const getBearerToken = (req: Request) => {
  const auth = req.headers.get('authorization') ?? ''
  const [type, token] = auth.split(' ')
  if (type?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

const isLoopbackHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]'

const isLocalRequest = (req: Request) => {
  const requestOrigin = req.headers.get('origin') ?? ''
  if (!requestOrigin) return false

  try {
    return isLoopbackHost(new URL(requestOrigin).hostname)
  } catch {
    return false
  }
}

const normalizeConfiguredBrokerPortalUrl = (value: unknown) => {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.origin
  } catch {
    return null
  }
}

const normalizeLocalBrokerPortalUrl = (value: unknown) => {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (!isLoopbackHost(parsed.hostname)) return null
    return parsed.origin
  } catch {
    return null
  }
}

const sanitizeRequestedPath = (value: unknown) => {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return '/dashboard'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/dashboard'

  try {
    const parsed = new URL(raw, 'https://internal.launch.local')
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`
    if (
      normalized === '/auth' ||
      normalized.startsWith('/auth/') ||
      normalized === '/launch-auth' ||
      normalized.startsWith('/launch-auth') ||
      normalized === '/managed-auth' ||
      normalized.startsWith('/managed-auth/')
    ) {
      return '/dashboard'
    }
    return normalized || '/dashboard'
  } catch {
    return '/dashboard'
  }
}

const normalizeStatus = (value: string | null | undefined) => String(value ?? '').trim().toLowerCase()

const isBrokerAccountLaunchable = (value: string | null | undefined) => {
  const normalized = normalizeStatus(value)
  if (!normalized) return true
  return !['inactive', 'disabled', 'banned', 'suspended'].includes(normalized)
}

const requireAuthenticatedUser = async (req: Request): Promise<{ user: AuthedUser } | { error: Response }> => {
  const supabaseUrl = getEnv('SUPABASE_URL')
  const anonKey = getEnv('SUPABASE_ANON_KEY')

  const token = getBearerToken(req)
  if (!token) return { error: json(req, 401, { error: 'Missing Authorization header' }) }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data, error } = await authClient.auth.getUser()
  if (error || !data.user) {
    return { error: json(req, 401, { error: 'Invalid session' }) }
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
    },
  }
}

const hasPortalAdminAccess = async (adminClient: ReturnType<typeof createClient>, userId: string) => {
  const { data: appUser, error: appUserError } = await adminClient
    .from('app_users')
    .select('role,is_super_admin')
    .eq('user_id', userId)
    .maybeSingle()

  if (appUserError) {
    throw new Error(appUserError.message)
  }

  if (appUser && (appUser.is_super_admin || appUser.role === 'super_admin' || appUser.role === 'admin')) {
    return true
  }

  const { data: roleRow, error: roleError } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['admin', 'super_admin'])
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (roleError) {
    throw new Error(roleError.message)
  }

  return Boolean(roleRow?.role === 'admin' || roleRow?.role === 'super_admin')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    if (req.headers.get('origin') && !getAllowedRequestOrigin(req)) {
      return new Response('Forbidden', { status: 403 })
    }
    return new Response(null, { status: 204, headers: getCorsHeaders(req) })
  }

  if (req.method !== 'POST') {
    return json(req, 405, { error: 'Method not allowed' })
  }

  try {
    const authResult = await requireAuthenticatedUser(req)
    if ('error' in authResult) return authResult.error

    const supabaseUrl = getEnv('SUPABASE_URL')
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const hasAccess = await hasPortalAdminAccess(adminClient, authResult.user.id)
    if (!hasAccess) {
      return json(req, 403, { error: 'Admin access required' })
    }

    const body = await req.json().catch(() => ({}))
    const brokerUserId = typeof body?.broker_user_id === 'string' ? body.broker_user_id.trim() : ''
    const requestedPath = sanitizeRequestedPath(body?.requested_path)
    const configuredBrokerPortalUrl = normalizeConfiguredBrokerPortalUrl(Deno.env.get('BROKER_PORTAL_URL'))
    const requestedBrokerPortalUrl = isLocalRequest(req) ? normalizeLocalBrokerPortalUrl(body?.broker_portal_url) : null
    const brokerPortalUrl = requestedBrokerPortalUrl ?? configuredBrokerPortalUrl

    if (!brokerUserId) {
      return json(req, 400, { error: 'broker_user_id is required' })
    }

    if (!brokerPortalUrl) {
      return json(req, 500, { error: 'BROKER_PORTAL_URL is not configured' })
    }

    const { data: brokerRow, error: brokerError } = await adminClient
      .from('app_users')
      .select('user_id,email,display_name,role,account_status')
      .eq('user_id', brokerUserId)
      .maybeSingle()

    if (brokerError) {
      return json(req, 500, { error: brokerError.message })
    }

    const broker = brokerRow as AppUserLookup | null
    if (!broker || broker.role !== 'broker') {
      return json(req, 404, { error: 'Broker account not found' })
    }

    if (!isBrokerAccountLaunchable(broker.account_status)) {
      return json(req, 400, { error: 'This broker account is not active and cannot be launched' })
    }

    const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(brokerUserId)
    if (authUserError) {
      return json(req, 500, { error: authUserError.message })
    }

    const authUser = authUserData.user
    if (!authUser) {
      return json(req, 404, { error: 'Broker auth account not found' })
    }

    const brokerEmail = authUser.email?.trim().toLowerCase() ?? ''
    if (!brokerEmail) {
      return json(req, 400, { error: 'The selected broker auth account does not have a valid email address' })
    }

    const appUserEmail = broker.email?.trim().toLowerCase() ?? ''
    if (appUserEmail && appUserEmail !== brokerEmail) {
      return json(req, 409, {
        error: 'Broker account email is out of sync with auth. Please sync the account email before launching.',
      })
    }

    const bannedUntil = typeof authUser.banned_until === 'string' ? Date.parse(authUser.banned_until) : Number.NaN
    if (Number.isFinite(bannedUntil) && bannedUntil > Date.now()) {
      return json(req, 400, { error: 'This broker auth account is currently banned and cannot be launched' })
    }

    const redirectUrl = new URL('/launch-auth', brokerPortalUrl)
    redirectUrl.searchParams.set('next', requestedPath)

    const { data: generateData, error: generateError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: brokerEmail,
      options: {
        redirectTo: redirectUrl.toString(),
      },
    })

    if (generateError || !generateData?.properties?.action_link) {
      return json(req, 500, { error: generateError?.message ?? 'Unable to create launch link' })
    }

    return json(req, 200, {
      actionLink: generateData.properties.action_link,
      redirectTo: redirectUrl.toString(),
      broker: {
        userId: broker.user_id,
        email: brokerEmail,
        displayName: broker.display_name,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return json(req, 500, { error: message })
  }
})
