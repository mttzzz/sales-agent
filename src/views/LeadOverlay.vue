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
const secondsLeft = ref(0)

let unlistenLead: UnlistenFn | null = null
let dismissTimer: ReturnType<typeof setTimeout> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null
const overlayWindow = getCurrentWebviewWindow()

function clearTimers(): void {
  if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null }
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
}

async function dismiss(): Promise<void> {
  clearTimers()
  leadId.value = null
  secondsLeft.value = 0
  try { await overlayWindow.hide() }
  catch (err) { console.warn('[overlay] hide failed', err) }
}

function arm(payload: LeadPayload): void {
  clearTimers()
  leadId.value = payload.lead_id
  secondsLeft.value = Math.round(AUTO_DISMISS_MS / 1000)

  countdownTimer = setInterval(() => {
    if (secondsLeft.value > 0) secondsLeft.value -= 1
  }, 1000)

  dismissTimer = setTimeout(() => { void dismiss() }, AUTO_DISMISS_MS)
}

onMounted(async () => {
  unlistenLead = await listen<LeadPayload>('new-lead', (e) => {
    arm(e.payload)
  })
})

onUnmounted(() => {
  if (unlistenLead) unlistenLead()
  clearTimers()
})
</script>

<template>
  <div class="overlay-root" @click="dismiss">
    <div class="card">
      <div class="ring">
        <span class="ring-num">{{ secondsLeft }}</span>
      </div>
      <div class="text">
        <div class="title">Новая заявка</div>
        <div class="subtitle">Сделка #{{ leadId ?? '—' }}</div>
        <div class="hint">Кликни чтобы закрыть · авто-закрытие через {{ secondsLeft }} с</div>
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

.ring {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  border: 2px solid rgba(255, 255, 255, 0.45);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.ring-num {
  font-size: 1.8rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.text { min-width: 0; }
.title {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.subtitle {
  font-size: 1.05rem;
  margin-top: 4px;
  opacity: 0.9;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
}
.hint {
  font-size: 0.78rem;
  opacity: 0.65;
  margin-top: 10px;
}
</style>
