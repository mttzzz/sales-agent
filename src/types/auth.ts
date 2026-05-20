export interface AmoUser {
  id: number
  name: string
  email: string
  avatar_url: string | null
}

export interface AccountInfo {
  id: number
  subdomain: string
  name: string
}

export type AuthPhase = 'login' | 'code' | 'main'

export interface AuthState {
  phase: AuthPhase
  /** Inputs from login screen, kept while user is on the code screen. */
  pending_account: string | null
  pending_email: string | null
  /** Filled after successful verify-code. */
  logged_in_user: AmoUser | null
  token: string | null
  dnd_on: boolean
  account: AccountInfo | null
}
