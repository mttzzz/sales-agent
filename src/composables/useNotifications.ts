import { ref } from 'vue'
import { emitTo } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

const OVERLAY_LABEL = 'lead-overlay'

const lastError = ref<string | null>(null)
const lastTriggeredAt = ref<string | null>(null)
const lastLeadId = ref<number | null>(null)

export function useOverlayDebug() {
  return { lastError, lastTriggeredAt, lastLeadId }
}

export async function notifyNewLead(leadId: number, leadUrl: string): Promise<void> {
  lastTriggeredAt.value = new Date().toISOString()
  lastLeadId.value = leadId
  lastError.value = null

  let overlay: WebviewWindow | null = null
  try {
    overlay = await WebviewWindow.getByLabel(OVERLAY_LABEL)
  }
  catch (err) {
    lastError.value = `getByLabel threw: ${String(err)}`
    console.error('[notify]', lastError.value)
    return
  }

  if (!overlay) {
    lastError.value = `window '${OVERLAY_LABEL}' not found (getByLabel returned null)`
    console.error('[notify]', lastError.value)
    return
  }

  try {
    await emitTo(OVERLAY_LABEL, 'new-lead', {
      lead_id: leadId,
      lead_url: leadUrl,
      at: new Date().toISOString(),
    })
  }
  catch (err) {
    lastError.value = `emitTo failed: ${String(err)}`
    console.error('[notify]', lastError.value)
  }

  try {
    await overlay.show()
  }
  catch (err) {
    lastError.value = `show() failed: ${String(err)}`
    console.error('[notify]', lastError.value)
    return
  }

  try { await overlay.setAlwaysOnTop(true) }
  catch (err) { console.warn('[notify] setAlwaysOnTop failed', err) }

  try { await overlay.center() }
  catch (err) { console.warn('[notify] center failed', err) }
}
