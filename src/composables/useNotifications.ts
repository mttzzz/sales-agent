import { emitTo } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

const OVERLAY_LABEL = 'lead-overlay'

export async function notifyNewLead(leadId: number): Promise<void> {
  const overlay = await WebviewWindow.getByLabel(OVERLAY_LABEL)
  if (!overlay) {
    console.warn('[notify] lead-overlay window not found')
    return
  }

  try {
    await emitTo(OVERLAY_LABEL, 'new-lead', {
      lead_id: leadId,
      at: new Date().toISOString(),
    })
    await overlay.show()
    await overlay.setAlwaysOnTop(true)
    await overlay.center()
  }
  catch (err) {
    console.warn('[notify] overlay show failed', err)
  }
}
