use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

const PERIODIC_CHECK_INTERVAL_SECS: u64 = 30 * 60;
const STARTUP_GRACE_SECS: u64 = 60;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_secs(STARTUP_GRACE_SECS)).await;
                loop {
                    if let Err(e) = check_and_install(&handle).await {
                        eprintln!("[updater] check failed: {e}");
                    }
                    tokio::time::sleep(Duration::from_secs(PERIODIC_CHECK_INTERVAL_SECS)).await;
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn check_and_install(handle: &AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let updater = handle.updater()?;
    let Some(update) = updater.check().await? else {
        return Ok(());
    };
    eprintln!(
        "[updater] update available: {} (current {})",
        update.version, update.current_version
    );
    update.download_and_install(|_, _| {}, || {}).await?;
    eprintln!("[updater] installed, restarting");
    handle.restart();
}
