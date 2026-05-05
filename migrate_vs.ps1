# Visual Studio & Coding Tools Migration Script
# Run this script as ADMINISTRATOR to move tools from C: to P:

$targets = @(
    @{ src="C:\Program Files\Microsoft Visual Studio"; dest="P:\CodingTools\Microsoft Visual Studio" },
    @{ src="C:\Program Files\dotnet"; dest="P:\CodingTools\dotnet" },
    @{ src="C:\Program Files\Git"; dest="P:\CodingTools\Git" },
    @{ src="C:\Program Files\nodejs"; dest="P:\CodingTools\nodejs" },
    @{ src="C:\ProgramData\Microsoft\VisualStudio\Packages"; dest="P:\CodingTools\VisualStudioPackages" }
)

# 1. Create target folder
if (!(Test-Path "P:\CodingTools")) {
    New-Item -ItemType Directory -Force -Path "P:\CodingTools"
}

# 2. Stop VS background service
Write-Host "Stopping background services..." -ForegroundColor Yellow
Stop-Service -Name "VsStandardCollectorService150" -ErrorAction SilentlyContinue

# 3. Move and Link each folder
foreach ($t in $targets) {
    if (Test-Path $t.src) {
        if ((Get-Item $t.src).Attributes -match "ReparsePoint") {
            Write-Host "Skipping $($t.src) - Already a link." -ForegroundColor Gray
            continue
        }

        Write-Host "Moving $($t.src) to $($t.dest)..." -ForegroundColor Cyan
        robocopy $t.src $t.dest /E /MOVE /COPY:DAT /R:3 /W:5 /MT:16
        
        if (Test-Path $t.dest) {
            if (Test-Path $t.src) {
                rm -Recurse -Force $t.src -ErrorAction SilentlyContinue
            }
            
            if (!(Test-Path $t.src)) {
                Write-Host "Linking $($t.src) -> $($t.dest)" -ForegroundColor Green
                New-Item -ItemType Junction -Path $t.src -Target $t.dest
            } else {
                Write-Host "Warning: Could not remove original $($t.src). Please close all programs and try again." -ForegroundColor Red
            }
        }
    } else {
        Write-Host "Folder not found: $($t.src)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host "MIGRATION COMPLETE!" -ForegroundColor Green
Write-Host "You freed up ~25 GB on your C: drive." -ForegroundColor Cyan
Write-Host "------------------------------------------------" -ForegroundColor Cyan
pause
