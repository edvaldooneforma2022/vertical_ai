[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$htmlFile = "C:\Users\edval\Downloads\melhorar p" + [char]0x00E1 + "gina.txt"
$cssFile = "C:\Users\edval\Downloads\css p" + [char]0x00E1 + "gina atual.txt"

Write-Output "HTML file: $htmlFile"
Write-Output "CSS file: $cssFile"
Write-Output "HTML exists: $(Test-Path $htmlFile)"
Write-Output "CSS exists: $(Test-Path $cssFile)"

if (-not (Test-Path $htmlFile) -or -not (Test-Path $cssFile)) {
    Write-Error "File not found!"
    exit 1
}

$htmlLines = [System.IO.File]::ReadAllLines($htmlFile, [System.Text.Encoding]::UTF8)
$cssContent = [System.IO.File]::ReadAllText($cssFile, [System.Text.Encoding]::UTF8)

Write-Output "HTML lines: $($htmlLines.Count)"
Write-Output "CSS length: $($cssContent.Length)"

$styleStart = -1
$styleEnd = -1

for ($i = 0; $i -lt $htmlLines.Count; $i++) {
    $trimmed = $htmlLines[$i].Trim()
    if ($trimmed -eq '<style>' -and $styleStart -eq -1) {
        $styleStart = $i
        Write-Output "Found <style> at line $($i+1)"
    }
    if ($trimmed -eq '</style>' -and $styleStart -ne -1 -and $styleEnd -eq -1) {
        $styleEnd = $i
        Write-Output "Found </style> at line $($i+1)"
        break
    }
}

if ($styleStart -eq -1 -or $styleEnd -eq -1) {
    Write-Error "Could not find style block!"
    exit 1
}

# Build new file: lines before <style> + <style> tag + full CSS + </style> tag + lines after </style>
$newLines = New-Object System.Collections.ArrayList

# Lines 0 to styleStart (including <style> tag)
for ($i = 0; $i -le $styleStart; $i++) {
    [void]$newLines.Add($htmlLines[$i])
}

# Add the full CSS content
[void]$newLines.Add($cssContent)

# Lines from styleEnd onwards (including </style> tag)
for ($i = $styleEnd; $i -lt $htmlLines.Count; $i++) {
    [void]$newLines.Add($htmlLines[$i])
}

# Backup
$backupPath = $htmlFile + ".bak"
Copy-Item $htmlFile $backupPath -Force
Write-Output "Backup: $backupPath"

# Save
$result = $newLines -join "`n"
[System.IO.File]::WriteAllText($htmlFile, $result, [System.Text.Encoding]::UTF8)

$finalLines = [System.IO.File]::ReadAllLines($htmlFile, [System.Text.Encoding]::UTF8)
Write-Output "DONE! Lines before: $($htmlLines.Count), Lines after: $($finalLines.Count)"
