import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

/**
 * Check for an update on launch. If found — download + install + relaunch.
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
