use std::path::PathBuf;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn swallow_delete_to_trash(paths: Vec<String>) -> Result<usize, String> {
    if paths.is_empty() {
        return Ok(0);
    }

    let mut deleted = 0usize;
    for raw in paths {
        let target = PathBuf::from(raw);
        trash::delete(&target).map_err(|err| format!("failed to move {:?} to trash: {}", target, err))?;
        deleted += 1;
    }

    Ok(deleted)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![greet, swallow_delete_to_trash])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
