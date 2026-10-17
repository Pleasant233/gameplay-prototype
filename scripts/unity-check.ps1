param(
    [string]$UnityPath = $env:UNITY_EDITOR_PATH,
    [switch]$BuildWindows,
    [switch]$Motion,
    [switch]$Audio
)
$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
$project = Join-Path $repository 'SpotlightGamejam'
$versionLine = Get-Content (Join-Path $project 'ProjectSettings/ProjectVersion.txt') | Select-Object -First 1
$version = ($versionLine -split ': ')[1]
if (-not $UnityPath) {
    $candidates = @(
        "C:\Program Files\Unity\Hub\Editor\$version\Editor\Unity.exe",
        "E:\Unity\6.3\$version\Editor\Unity.exe"
    )
    $UnityPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $UnityPath -or -not (Test-Path -LiteralPath $UnityPath)) { throw 'Pass -UnityPath to the installed Unity editor, or set UNITY_EDITOR_PATH.' }
$artifactDirectory = Join-Path $repository 'artifacts'
New-Item -ItemType Directory -Force $artifactDirectory | Out-Null
$method = if ($BuildWindows) { 'ElementHabitat.Editor.HabitatTools.BuildWindows' } elseif ($Motion) { 'ElementHabitat.Editor.HabitatMotionValidation.Validate' } elseif ($Audio) { 'ElementHabitat.Editor.HabitatAudioValidation.Validate' } else { 'ElementHabitat.Editor.HabitatTools.Validate' }
$log = Join-Path $artifactDirectory $(if ($BuildWindows) { 'unity-build.log' } elseif ($Motion) { 'unity-motion.log' } elseif ($Audio) { 'unity-audio.log' } else { 'unity-validation.log' })
$arguments = @('-batchmode', '-projectPath', ('"' + $project + '"'), '-executeMethod', $method, '-logFile', ('"' + $log + '"'))
if ($BuildWindows) { $arguments += '-quit' }
$launchTime = [DateTime]::UtcNow
$process = Start-Process -FilePath $UnityPath -ArgumentList $arguments -PassThru -WindowStyle Hidden
try {
    # Unity is a GUI executable on Windows. Explicitly wait; its launcher exit is not the result.
    while (-not $process.WaitForExit(1000)) { }
    if ($process.ExitCode -ne 0) { throw "Unity exited with code $($process.ExitCode). Inspect $log" }
    if (-not $BuildWindows) {
        $report = Join-Path $artifactDirectory $(if ($Motion) { 'unity-motion/motion-validation.json' } elseif ($Audio) { 'unity-audio/audio-validation.json' } else { 'unity/validation.json' })
        if (-not (Test-Path -LiteralPath $report)) { throw "Unity did not create a validation report. Inspect $log" }
        if ((Get-Item -LiteralPath $report).LastWriteTimeUtc -lt $launchTime) { throw "Unity did not create a fresh validation report. Inspect $log" }
        if ($Motion -or $Audio) {
            $result = Get-Content -LiteralPath $report -Raw | ConvertFrom-Json
            [pscustomobject]@{ Passed = $result.passed; Checks = $result.checks.Count; Frames = $result.frames.Count; Errors = $result.errors.Count; Report = $report } | Format-List
            if (-not $result.passed -or $result.errors.Count -gt 0) { throw "Presentation validation failed. Inspect $report" }
        } else { Get-Content -LiteralPath $report }
    }
    Write-Output "Unity completed. Log: $log"
} finally { $process.Dispose() }
