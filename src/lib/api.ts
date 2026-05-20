import type { AmoUser } from '../types/auth'

const API_BASE_URL = 'https://octane.pushka.biz/api/desktop/v1'
const BOOTSTRAP_TOKEN = (import.meta.env.VITE_DESKTOP_BOOTSTRAP_TOKEN as string | undefined) ?? ''

export interface AccountInfo {
  id: number
  subdomain: string
  name: string
}

export interface VerifyCodeResponse {
  token: string
  amo_user: AmoUser
  dnd_on: boolean
  account: AccountInfo
}

export interface MeResponse {
  amo_user: AmoUser
  dnd_on: boolean
  account: AccountInfo | null
}

export class ApiError extends Error {
  constructor(public status: number, public payload: unknown, message?: string) {
    super(message ?? `API error ${status}`)
  }
}

function ensureBootstrap(): void {
  if (!BOOTSTRAP_TOKEN) {
    throw new Error('VITE_DESKTOP_BOOTSTRAP_TOKEN not set — build misconfigured')
  }
}

async function readJson(r: Response): Promise<unknown> {
  try { return await r.json() } catch { return null }
}

async function bootstrapRequest(path: string, init: RequestInit = {}): Promise<Response> {
  ensureBootstrap()
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Desktop-Bootstrap-Token': BOOTSTRAP_TOKEN,
      ...(init.headers ?? {}),
    },
  })
}

async function bearerRequest(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  })
}

export async function listAmoUsers(accountSlug: string): Promise<AmoUser[]> {
  const r = await bootstrapRequest(`/accounts/${encodeURIComponent(accountSlug)}/amo-users`)
  if (!r.ok) throw new ApiError(r.status, await readJson(r))
  return r.json()
}

export async function requestCode(amoUserId: number): Promise<void> {
  const r = await bootstrapRequest('/auth/request-code', {
    method: 'POST',
    body: JSON.stringify({ amo_user_id: amoUserId }),
  })
  if (r.status === 429) throw new ApiError(429, null, 'Слишком частые запросы. Подожди минуту.')
  if (!r.ok) throw new ApiError(r.status, await readJson(r))
}

export async function verifyCode(amoUserId: number, code: string, deviceLabel?: string): Promise<VerifyCodeResponse> {
  const r = await bootstrapRequest('/auth/verify-code', {
    method: 'POST',
    body: JSON.stringify({ amo_user_id: amoUserId, code, device_label: deviceLabel }),
  })
  if (r.status === 422) throw new ApiError(422, await readJson(r), 'Неверный или истёкший код')
  if (!r.ok) throw new ApiError(r.status, await readJson(r))
  return r.json() as Promise<VerifyCodeResponse>
}

export async function me(token: string): Promise<MeResponse> {
  const r = await bearerRequest('/me', token)
  if (!r.ok) throw new ApiError(r.status, await readJson(r))
  return r.json() as Promise<MeResponse>
}

export async function logout(token: string): Promise<void> {
  const r = await bearerRequest('/auth/logout', token, { method: 'POST' })
  if (!r.ok && r.status !== 401) throw new ApiError(r.status, await readJson(r))
}

export async function setDnd(token: string, on: boolean): Promise<{ dnd_on: boolean }> {
  const r = await bearerRequest('/dnd', token, {
    method: 'POST',
    body: JSON.stringify({ on }),
  })
  if (!r.ok) throw new ApiError(r.status, await readJson(r))
  return r.json() as Promise<{ dnd_on: boolean }>
}
