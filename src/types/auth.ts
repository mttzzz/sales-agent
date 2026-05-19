export interface AmoUser {
  id: number
  name: string
  email: string
  avatar_url: string | null
}

export type AuthPhase = 'login' | 'code' | 'main'

export interface AuthState {
  phase: AuthPhase
  selected_user: AmoUser | null
  /** При phase='main' хранит того же selected_user — для удобства потребителей. */
  logged_in_user: AmoUser | null
}
