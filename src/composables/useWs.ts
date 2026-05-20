import { readonly, ref } from 'vue'
import Pusher, { type Channel } from 'pusher-js'

const APP_KEY = '6cff1c3f447deb40f3f26bda6a8fa303'
const WS_HOST = 'reverb.pushka.biz'
const WS_PORT = 443
const AUTH_ENDPOINT = 'https://octane.pushka.biz/api/desktop/v1/broadcasting/auth'

export type WsStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

const status = ref<WsStatus>('idle')

let pusher: Pusher | null = null
let channel: Channel | null = null

interface DebugEchoPayload {
  message: string
  at: string
}

export function startWs(token: string, amoUserId: number): void {
  if (pusher) return
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
  }
}
