use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, WindowEvent};
use tauri_plugin_updater::UpdaterExt;

const PERIODIC_CHECK_INTERVAL_SECS: u64 = 3 * 60;
const STARTUP_GRACE_SECS: u64 = 15;
const FOCUS_DEBOUNCE_SECS: u64 = 60;

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

            if let Some(main_win) = app.get_webview_window("main") {
                let handle_for_focus = app.handle().clone();
                let last_focus_check: Arc<Mutex<Option<Instant>>> = Arc::new(Mutex::new(None));
                main_win.on_window_event(move |evt| {
                    if matches!(evt, WindowEvent::Focused(true)) {
                        let now = Instant::now();
                        let mut last = last_focus_check.lock().unwrap();
                        if let Some(prev) = *last {
                            if now.duration_since(prev).as_secs() < FOCUS_DEBOUNCE_SECS {
                                return;
                            }
                        }
                        *last = Some(now);
                        let h = handle_for_focus.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Err(e) = check_and_install(&h).await {
                                eprintln!("[updater] focus-check failed: {e}");
                            }
                        });
                    }
                });
            }

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
