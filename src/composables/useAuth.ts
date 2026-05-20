import { reactive, readonly } from 'vue'
import { load, type Store } from '@tauri-apps/plugin-store'
import * as api from '../lib/api'
import type { AmoUser, AuthState } from '../types/auth'

const STORE_FILE = 'auth.json'
const STORE_KEY = 'state'
const ACCOUNT_SLUG = 'mogoby'

const state = reactive<AuthState>({
  phase: 'login',
  selected_user: null,
  logged_in_user: null,
  token: null,
  dnd_on: false,
  account: null,
})

let storePromise: Promise<Store> | null = null

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { autoSave: false, defaults: {} })
  }
  return storePromise
}

async function persist(): Promise<void> {
  const store = await getStore()
  await store.set(STORE_KEY, JSON.parse(JSON.stringify(state)))
  await store.save()
}

function resetAuth(): void {
  state.phase = 'login'
  state.selected_user = null
  state.logged_in_user = null
  state.token = null
  state.dnd_on = false
  state.account = null
}

export async function loadAuth(): Promise<void> {
  const store = await getStore()
  const saved = await store.get<AuthState>(STORE_KEY)
  if (!saved) return

  state.phase = saved.phase
  state.selected_user = saved.selected_user
  state.logged_in_user = saved.logged_in_user
  state.token = saved.token
  state.dnd_on = saved.dnd_on ?? false
  state.account = saved.account

  if (state.phase === 'main' && state.token) {
    try {
      const meRes = await api.me(state.token)
      state.logged_in_user = meRes.amo_user
      state.dnd_on = meRes.dnd_on
      state.account = meRes.account
    } catch (e) {
      if (e instanceof api.ApiError && e.status === 401) {
        resetAuth()
        await persist()
      } else {
        console.warn('Failed to validate session:', e)
      }
    }
  }
}

export async function loadAmoUsers(): Promise<AmoUser[]> {
  return api.listAmoUsers(ACCOUNT_SLUG)
}

export async function selectUser(user: AmoUser): Promise<void> {
  await api.requestCode(user.id)
  state.selected_user = user
  state.phase = 'code'
  await persist()
}

export async function verifyCode(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^\d{6}$/.test(code)) return { ok: false, error: 'Код должен быть 6 цифр' }
  if (!state.selected_user) return { ok: false, error: 'Не выбран пользователь' }

  try {
    const result = await api.verifyCode(state.selected_user.id, code, 'desktop')
    state.token = result.token
    state.logged_in_user = result.amo_user
    state.dnd_on = result.dnd_on
    state.account = result.account
    state.phase = 'main'
    await persist()
    return { ok: true }
  } catch (e) {
    if (e instanceof api.ApiError && e.status === 422) {
      return { ok: false, error: 'Неверный или истёкший код' }
    }
    return { ok: false, error: e instanceof Error ? e.message : 'Ошибка сервера' }
  }
}

export async function logout(): Promise<void> {
  const token = state.token
  resetAuth()
  await persist()
  if (token) {
    try { await api.logout(token) } catch { /* best-effort */ }
  }
}

export async function backToLogin(): Promise<void> {
  state.phase = 'login'
  state.selected_user = null
  await persist()
}

export async function toggleDnd(): Promise<void> {
  if (!state.token) return
  try {
    const res = await api.setDnd(state.token, !state.dnd_on)
    state.dnd_on = res.dnd_on
    await persist()
  } catch (e) {
    console.warn('Failed to toggle DND:', e)
  }
}

export function useAuth() {
  return {
    state: readonly(state),
    selectUser,
    verifyCode,
    logout,
    backToLogin,
    loadAmoUsers,
    toggleDnd,
  }
}
