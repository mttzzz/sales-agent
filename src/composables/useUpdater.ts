import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

const CHECK_INTERVAL_MS = 30 * 60 * 1000

let periodicTimer: ReturnType<typeof setInterval> | null = null

/**
 * Check for an update. If found — download + install + relaunch.
 * Failures are logged and swallowed so the app still launches on current version.
 */
export async function maybeAutoUpdate(): Promise<void> {
  try {
    const update = await check()
    if (!update) {
      return
    }
    console.log(`[updater] Update available: ${update.version} (current: ${update.currentVersion})`)
    await update.downloadAndInstall()
    console.log('[updater] Installed, relaunching')
    await relaunch()
  } catch (e) {
    console.warn('[updater] Auto-update failed:', e)
  }
}

/**
 * Start periodic update checks every 30 minutes.
 * If a newer version is published while the app is open, it will be
 * downloaded and installed automatically — app restarts in-place.
 */
export function startPeriodicCheck(): void {
  if (periodicTimer !== null) return
  periodicTimer = setInterval(maybeAutoUpdate, CHECK_INTERVAL_MS)
}
