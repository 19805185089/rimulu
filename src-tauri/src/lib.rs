use std::io::{Cursor, Read};
use std::path::{Component, Path, PathBuf};
use std::{env, fs};
use zip::ZipArchive;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct HatchPetManifest {
    id: String,
    display_name: String,
    description: String,
    spritesheet_path: String,
    theme: Option<HatchPetTheme>,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct HatchPetTheme {
    primary_color: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct InstalledHatchPet {
    id: String,
    display_name: String,
    description: String,
    spritesheet_path: String,
    theme: Option<HatchPetTheme>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct InstalledHatchPetZipResult {
    pet: InstalledHatchPet,
}

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
        trash::delete(&target)
            .map_err(|err| format!("failed to move {:?} to trash: {}", target, err))?;
        deleted += 1;
    }

    Ok(deleted)
}

fn codex_home_dir() -> Option<PathBuf> {
    if let Some(path) = env::var_os("CODEX_HOME") {
        return Some(PathBuf::from(path));
    }
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(|home| PathBuf::from(home).join(".codex"))
}

fn pets_dir() -> Result<PathBuf, String> {
    let Some(codex_home) = codex_home_dir() else {
        return Err("failed to resolve Codex home directory".into());
    };
    Ok(codex_home.join("pets"))
}

fn validate_relative_zip_path(path: &str) -> Result<PathBuf, String> {
    let candidate = Path::new(path);
    if candidate.is_absolute() {
        return Err(format!("zip entry path must be relative: {}", path));
    }

    let mut normalized = PathBuf::new();
    for component in candidate.components() {
        match component {
            Component::Normal(part) => normalized.push(part),
            Component::CurDir => {}
            _ => return Err(format!("zip entry path is not safe: {}", path)),
        }
    }

    if normalized.as_os_str().is_empty() {
        return Err(format!("zip entry path is empty: {}", path));
    }
    Ok(normalized)
}

fn zip_path_to_name(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn find_manifest_entry<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
) -> Result<(usize, PathBuf), String> {
    let mut selected: Option<(usize, PathBuf)> = None;

    for index in 0..archive.len() {
        let Ok(file) = archive.by_index(index) else {
            continue;
        };
        if file.is_dir() {
            continue;
        };
        let Ok(entry_path) = validate_relative_zip_path(file.name()) else {
            continue;
        };
        if entry_path.file_name().and_then(|name| name.to_str()) != Some("pet.json") {
            continue;
        }

        let depth = entry_path.components().count();
        match &selected {
            Some((_, current_path)) if current_path.components().count() <= depth => {}
            _ => selected = Some((index, entry_path)),
        }
    }

    selected.ok_or_else(|| "zip package must contain pet.json".into())
}

fn safe_pet_id(id: &str) -> Result<String, String> {
    let trimmed = id.trim();
    let is_valid = !trimmed.is_empty()
        && trimmed
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_');
    if !is_valid {
        return Err("pet id must only contain letters, numbers, hyphen, or underscore".into());
    }
    Ok(trimmed.to_string())
}

#[tauri::command]
fn install_hatch_pet_zip(file_name: String, bytes: Vec<u8>) -> Result<InstalledHatchPetZipResult, String> {
    if !file_name.to_lowercase().ends_with(".zip") {
        return Err("请选择 zip 压缩包".into());
    }
    if bytes.is_empty() {
        return Err("zip 压缩包为空".into());
    }

    let cursor = Cursor::new(bytes);
    let mut archive = ZipArchive::new(cursor).map_err(|err| format!("failed to read zip: {}", err))?;
    let (manifest_index, manifest_entry_path) = find_manifest_entry(&mut archive)?;
    let manifest_dir = manifest_entry_path.parent().unwrap_or_else(|| Path::new("")).to_path_buf();
    let mut raw_manifest = String::new();
    archive
        .by_index(manifest_index)
        .map_err(|err| format!("failed to open pet.json: {}", err))?
        .read_to_string(&mut raw_manifest)
        .map_err(|err| format!("failed to read pet.json: {}", err))?;
    let manifest: HatchPetManifest =
        serde_json::from_str(&raw_manifest).map_err(|err| format!("failed to parse pet.json: {}", err))?;
    let pet_id = safe_pet_id(&manifest.id)?;
    let spritesheet_relative = validate_relative_zip_path(&manifest.spritesheet_path)?;
    let spritesheet_entry_path = manifest_dir.join(&spritesheet_relative);
    let spritesheet_entry_name = zip_path_to_name(&spritesheet_entry_path);
    let mut spritesheet = Vec::new();
    archive
        .by_name(&spritesheet_entry_name)
        .map_err(|_| format!("zip package must contain {}", manifest.spritesheet_path))?
        .read_to_end(&mut spritesheet)
        .map_err(|err| format!("failed to read spritesheet: {}", err))?;
    if spritesheet.is_empty() {
        return Err("spritesheet is empty".into());
    }

    let install_root = pets_dir()?;
    fs::create_dir_all(&install_root)
        .map_err(|err| format!("failed to create pets directory {:?}: {}", install_root, err))?;
    let pet_dir = install_root.join(&pet_id);
    if pet_dir.exists() {
        fs::remove_dir_all(&pet_dir)
            .map_err(|err| format!("failed to replace existing pet {:?}: {}", pet_dir, err))?;
    }
    fs::create_dir_all(&pet_dir)
        .map_err(|err| format!("failed to create pet directory {:?}: {}", pet_dir, err))?;
    fs::write(pet_dir.join("pet.json"), raw_manifest)
        .map_err(|err| format!("failed to write pet.json: {}", err))?;
    let target_spritesheet_path = pet_dir.join(&spritesheet_relative);
    if let Some(parent) = target_spritesheet_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("failed to create spritesheet directory {:?}: {}", parent, err))?;
    }
    fs::write(&target_spritesheet_path, spritesheet)
        .map_err(|err| format!("failed to write spritesheet: {}", err))?;

    Ok(InstalledHatchPetZipResult {
        pet: InstalledHatchPet {
            id: pet_id,
            display_name: manifest.display_name,
            description: manifest.description,
            spritesheet_path: target_spritesheet_path.to_string_lossy().into_owned(),
            theme: manifest.theme,
        },
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            swallow_delete_to_trash,
            install_hatch_pet_zip
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
