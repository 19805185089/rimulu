$ErrorActionPreference = "Stop"

Write-Host "[safe-dev] Stopping stale Rust/Tauri processes..."
$names = @("cargo", "rustc", "tauri", "appsdesktop", "appsdesktop_lib")
Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $names -contains $_.ProcessName } |
  ForEach-Object {
    try {
      Stop-Process -Id $_.Id -Force -ErrorAction Stop
      Write-Host ("[safe-dev] Stopped {0} ({1})" -f $_.ProcessName, $_.Id)
    } catch {
      Write-Warning ("[safe-dev] Failed to stop {0} ({1}): {2}" -f $_.ProcessName, $_.Id, $_.Exception.Message)
    }
  }

Write-Host "[safe-dev] Cleaning incremental cache..."
cargo clean --manifest-path .\src-tauri\Cargo.toml

Write-Host "[safe-dev] Starting Tauri dev..."
npm run tauri dev
