import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

/* One-shot on-launch update check (fast user feedback).
   Periodic 30-min checks live in Rust (src-tauri/src/lib.rs setup()) — JS setInterval
   gets throttled by Chromium when window is hidden/tray. Rust timer fires regardless. */
export async function maybeAutoUpdate(): Promise<void> {
  try {
    const update = await check()
    if (!update) return
    console.log(`[updater] update available: ${update.version} (current: ${update.currentVersion})`)
    await update.downloadAndInstall()
    await relaunch()
  } catch (e) {
    console.warn('[updater] launch-time check failed:', e)
  }
}
