import { readonly, ref } from 'vue'
import Pusher, { type Channel } from 'pusher-js'
import { notifyNewLead } from './useNotifications'

const APP_KEY = (import.meta.env.VITE_SALES_AGENT_APP_KEY as string | undefined) ?? ''
const WS_HOST = (import.meta.env.VITE_SALES_AGENT_WS_HOST as string | undefined) ?? 'reverb.pushka.biz'
const WS_PORT = 443
const AUTH_ENDPOINT = (import.meta.env.VITE_SALES_AGENT_AUTH_ENDPOINT as string | undefined)
  ?? 'https://octane.pushka.biz/api/desktop/v1/broadcasting/auth'

export type WsStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

interface NewLeadPayload {
  lead_id: number
  lead_url: string
  at: string
}

const status = ref<WsStatus>('idle')
const eventsReceived = ref(0)
const lastEventName = ref<string | null>(null)

let pusher: Pusher | null = null
let channel: Channel | null = null

interface DebugEchoPayload {
  message: string
  at: string
}

export function startWs(token: string, amoUserId: number): void {
  if (pusher) return
  if (!APP_KEY) {
    console.warn('[ws] VITE_SALES_AGENT_APP_KEY not set — build misconfigured, skipping WS')
    status.value = 'error'
    return
  }
  status.value = 'connecting'

  pusher = new Pusher(APP_KEY, {
    cluster: 'eu',
    wsHost: WS_HOST,
    wsPort: WS_PORT,
    wssPort: WS_PORT,
    forceTLS: true,
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
    authEndpoint: AUTH_ENDPOINT,
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  })

  pusher.connection.bind('connected', () => {
    console.log('[ws] connected')
    status.value = 'connected'
  })
  pusher.connection.bind('disconnected', () => {
    console.log('[ws] disconnected')
    status.value = 'disconnected'
  })
  pusher.connection.bind('error', (err: unknown) => {
    console.warn('[ws] error', err)
    status.value = 'error'
  })

  pusher.bind_global((event: string, data: unknown) => {
    if (event.startsWith('pusher:') || event.startsWith('pusher_internal:')) return
    eventsReceived.value += 1
    lastEventName.value = event
    console.log(`[ws-global] event=${event} data=`, data)
  })

  const channelName = `private-amoUser.${amoUserId}`
  channel = pusher.subscribe(channelName)
  channel.bind('pusher:subscription_succeeded', () => {
    console.log('[ws] subscribed:', channelName)
  })
  channel.bind('pusher:subscription_error', (err: unknown) => {
    console.warn('[ws] subscribe error', err)
    status.value = 'error'
  })
  channel.bind('DebugEcho', (data: DebugEchoPayload) => {
    console.log('[ws] DebugEcho:', data)
  })
  channel.bind('NewLeadIncoming', (data: NewLeadPayload) => {
    console.log('[ws] NewLeadIncoming:', data)
    void notifyNewLead(data.lead_id, data.lead_url)
  })
}

export function stopWs(): void {
  if (channel) {
    channel.unbind_all()
    channel = null
  }
  if (pusher) {
    pusher.disconnect()
    pusher = null
  }
  status.value = 'idle'
}

export function useWs() {
  return {
    status: readonly(status),
    eventsReceived: readonly(eventsReceived),
    lastEventName: readonly(lastEventName),
  }
}
