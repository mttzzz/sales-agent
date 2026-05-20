import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'

let permissionResolved: Promise<boolean> | null = null

async function ensurePermission(): Promise<boolean> {
  if (!permissionResolved) {
    permissionResolved = (async () => {
      try {
        if (await isPermissionGranted()) return true
        const granted = await requestPermission()
        return granted === 'granted'
      }
      catch (err) {
        console.warn('[notify] permission check failed', err)
        return false
      }
    })()
  }
  return permissionResolved
}

export async function notifyNewLead(leadId: number): Promise<void> {
  if (!(await ensurePermission())) return

  try {
    sendNotification({
      title: 'Новая заявка',
      body: `Сделка #${leadId}`,
    })
  }
  catch (err) {
    console.warn('[notify] sendNotification failed', err)
  }
}
