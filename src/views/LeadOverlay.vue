<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

const AUTO_DISMISS_MS = 30_000

interface LeadPayload {
  lead_id: number
  at: string
}

const leadId = ref<number | null>(null)

let unlistenLead: UnlistenFn | null = null
let dismissTimer: ReturnType<typeof setTimeout> | null = null
const overlayWindow = getCurrentWebviewWindow()

function clearDismiss(): void {
  if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null }
}

async function dismiss(): Promise<void> {
  clearDismiss()
  leadId.value = null
  try { await overlayWindow.hide() }
  catch (err) { console.warn('[overlay] hide failed', err) }
}

function arm(payload: LeadPayload): void {
  clearDismiss()
  leadId.value = payload.lead_id
  dismissTimer = setTimeout(() => { void dismiss() }, AUTO_DISMISS_MS)
}

onMounted(async () => {
  unlistenLead = await listen<LeadPayload>('new-lead', (e) => {
    arm(e.payload)
  })
})

onUnmounted(() => {
  if (unlistenLead) unlistenLead()
  clearDismiss()
})
</script>

<template>
  <div class="overlay-root" @click="dismiss">
    <div class="card">
      <div class="icon">
        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <div class="text">
        <div class="title">Новая заявка</div>
        <div class="subtitle">Сделка #{{ leadId ?? '—' }}</div>
      </div>
    </div>
  </div>
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
  background: transparent;
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, 'Segoe UI', Roboto, sans-serif;
  user-select: none;
  cursor: pointer;
}
#overlay { height: 100%; }
</style>

<style scoped>
.overlay-root {
  height: 100vh;
  width: 100vw;
  display: grid;
  place-items: center;
  padding: 14px;
  box-sizing: border-box;
}

.card {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1f3a8a 0%, #2d6cdf 100%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 18px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08) inset;
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 22px 26px;
  box-sizing: border-box;
  color: white;
}

.icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
  border: 2px solid rgba(255, 255, 255, 0.4);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: white;
}

.text { min-width: 0; }
.title {
  font-size: 1.45rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.subtitle {
  font-size: 1.1rem;
  margin-top: 6px;
  opacity: 0.92;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
}
</style>
