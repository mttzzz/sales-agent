import { reactive, readonly } from 'vue'
import { load, type Store } from '@tauri-apps/plugin-store'
import type { AmoUser, AuthState } from '../types/auth'

const STORE_FILE = 'auth.json'
const STORE_KEY = 'state'

const state = reactive<AuthState>({
  phase: 'login',
  selected_user: null,
  logged_in_user: null,
})

let storePromise: Promise<Store> | null = null

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { autoSave: false })
  }
  return storePromise
}

async function persist(): Promise<void> {
  const store = await getStore()
  await store.set(STORE_KEY, JSON.parse(JSON.stringify(state)))
  await store.save()
}

export async function loadAuth(): Promise<void> {
  const store = await getStore()
  const saved = await store.get<AuthState>(STORE_KEY)
  if (saved) {
    state.phase = saved.phase
    state.selected_user = saved.selected_user
    state.logged_in_user = saved.logged_in_user
  }
}

export function selectUser(user: AmoUser): void {
  state.selected_user = user
  state.phase = 'code'
  void persist()
}

export function verifyCode(code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false
  if (!state.selected_user) return false
  state.logged_in_user = state.selected_user
  state.phase = 'main'
  void persist()
  return true
}

export function logout(): void {
  state.phase = 'login'
  state.selected_user = null
  state.logged_in_user = null
  void persist()
}

export function backToLogin(): void {
  state.phase = 'login'
  state.selected_user = null
  void persist()
}

export function useAuth() {
  return {
    state: readonly(state),
    selectUser,
    verifyCode,
    logout,
    backToLogin,
  }
}
