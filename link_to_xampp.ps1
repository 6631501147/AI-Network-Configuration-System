# ================================================================
#  link_to_xampp.ps1  — Creates a symlink inside XAMPP htdocs
#  so you don't need to copy the project folder.
#
#  HOW TO RUN:
#    1. Open PowerShell as Administrator
#    2. Run:  .\link_to_xampp.ps1
# ================================================================

$projectPath = $PSScriptRoot   # this folder
$xamppHtdocs = "C:\xampp\htdocs"
$linkName    = "AI-Network-Configuration-System"
$linkPath    = Join-Path $xamppHtdocs $linkName

Write-Host ""
Write-Host "NetConfig AI — XAMPP Symlink Setup" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project folder : $projectPath"
Write-Host "XAMPP htdocs   : $xamppHtdocs"
Write-Host "Symlink target : $linkPath"
Write-Host ""

# Check XAMPP exists
if (-not (Test-Path $xamppHtdocs)) {
    Write-Host "ERROR: XAMPP htdocs not found at $xamppHtdocs" -ForegroundColor Red
    Write-Host "Please install XAMPP or update the `$xamppHtdocs path in this script." -ForegroundColor Yellow
    exit 1
}

# Remove existing link/folder if present
if (Test-Path $linkPath) {
    Write-Host "Removing existing link/folder at $linkPath ..." -ForegroundColor Yellow
    Remove-Item $linkPath -Recurse -Force
}

# Create symlink (requires Admin rights)
try {
    New-Item -ItemType SymbolicLink -Path $linkPath -Target $projectPath -ErrorAction Stop | Out-Null
    Write-Host "Symlink created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Make sure Apache and MySQL are running in XAMPP Control Panel"
    Write-Host "  2. Open: http://localhost/AI-Network-Configuration-System/setup.php"
    Write-Host "     (Click 'Run Database Setup' to create the database)"
    Write-Host "  3. Then go to: http://localhost/AI-Network-Configuration-System/login.html"
    Write-Host ""
} catch {
    Write-Host "ERROR: Could not create symlink." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure you are running PowerShell as Administrator!" -ForegroundColor Yellow
}

Read-Host "Press Enter to exit"
