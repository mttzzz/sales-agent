<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { openUrl } from '@tauri-apps/plugin-opener'

const AUTO_DISMISS_MS = 30_000

interface LeadPayload {
  lead_id: number
  lead_url: string
  at: string
}

const leadId = ref<number | null>(null)
const leadUrl = ref<string>('')

let unlistenLead: UnlistenFn | null = null
let dismissTimer: ReturnType<typeof setTimeout> | null = null
const overlayWindow = getCurrentWebviewWindow()

function clearDismiss(): void {
  if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null }
}

async function dismiss(): Promise<void> {
  clearDismiss()
  leadId.value = null
  leadUrl.value = ''
  try { await overlayWindow.hide() }
  catch (err) { console.warn('[overlay] hide failed', err) }
}

async function accept(): Promise<void> {
  const url = leadUrl.value
  if (url) {
    try { await openUrl(url) }
    catch (err) { console.warn('[overlay] openUrl failed', err) }
  }
  await dismiss()
}

function arm(payload: LeadPayload): void {
  clearDismiss()
  leadId.value = payload.lead_id
  leadUrl.value = payload.lead_url
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
  <div class="overlay-root">
    <div class="card">
      <div class="header">
        <div class="icon">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <div class="text">
          <div class="title">Новая заявка</div>
        </div>
      </div>
      <div class="actions">
        <button class="btn-secondary" type="button" @click="dismiss">Отказаться</button>
        <button class="btn-primary" type="button" @click="accept">Принять</button>
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
  flex-direction: column;
  padding: 18px 22px;
  box-sizing: border-box;
  color: white;
  gap: 14px;
}

.header {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.icon {
  width: 54px;
  height: 54px;
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
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.actions {
  display: flex;
  gap: 10px;
}
.btn-primary, .btn-secondary {
  flex: 1;
  padding: 10px 14px;
  font-size: 0.92rem;
  font-weight: 600;
  font-family: inherit;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.05s ease, background 0.15s;
}
.btn-primary:active, .btn-secondary:active { transform: scale(0.97); }

.btn-primary {
  background: white;
  color: #1f3a8a;
  border: none;
}
.btn-primary:hover { background: rgba(255, 255, 255, 0.92); }

.btn-secondary {
  background: transparent;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.4);
}
.btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }
</style>
