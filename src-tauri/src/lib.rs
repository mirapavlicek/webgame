// NetTycoon — Tauri v2 entry point
// Čistý desktop wrapper kolem statické HTML hry. Žádný backend Rust kód neběží;
// všechna herní logika je v JS (js/*.js). V budoucnu sem lze přidat tauri::command
// handlery pro např. native save dialog, crash reporting, Steam API atd.

#[cfg(debug_assertions)]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                // V dev buildu otevři devtools automaticky
                if let Some(window) = _app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // greet,  // sem se dávají tauri::command handlery
        ])
        .run(tauri::generate_context!())
        .expect("chyba při spouštění Tauri aplikace");
}

// Příklad command handleru (zatím nepoužitý). Viz tauri.app docs.
// #[tauri::command]
// fn greet(name: &str) -> String { format!("Ahoj, {}!", name) }
