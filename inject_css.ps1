$htmlFile = "C:\Users\edval\Downloads\melhorar p" + [char]0x00E1 + "gina.txt"
$cssExtraFile = "C:\Users\edval\Downloads\css_extra_para_html.txt"

$htmlLines = [System.IO.File]::ReadAllLines($htmlFile, [System.Text.Encoding]::UTF8)
$cssExtra = [System.IO.File]::ReadAllText($cssExtraFile, [System.Text.Encoding]::UTF8)

Write-Output "HTML linhas: $($htmlLines.Count)"
Write-Output "CSS extra tamanho: $($cssExtra.Length)"

# Encontrar a linha </head>
$headEnd = -1
for ($i = 0; $i -lt $htmlLines.Count; $i++) {
    if ($htmlLines[$i].Trim() -eq '</head>') {
        $headEnd = $i
        Write-Output "Encontrado </head> na linha $($i+1)"
        break
    }
}

if ($headEnd -eq -1) {
    Write-Error "</head> nao encontrado!"
    exit 1
}

# Backup
$bak = $htmlFile + ".bak2"
Copy-Item $htmlFile $bak -Force

# Inserir <style>CSS</style> ANTES do </head>
$newLines = New-Object System.Collections.ArrayList

# Linhas 0 ate antes do </head>
for ($i = 0; $i -lt $headEnd; $i++) {
    [void]$newLines.Add($htmlLines[$i])
}

# Nova tag <style> com CSS extra
[void]$newLines.Add("    <style>")
[void]$newLines.Add($cssExtra)
[void]$newLines.Add("    </style>")

# </head> e o resto
for ($i = $headEnd; $i -lt $htmlLines.Count; $i++) {
    [void]$newLines.Add($htmlLines[$i])
}

$result = $newLines -join "`n"
[System.IO.File]::WriteAllText($htmlFile, $result, [System.Text.Encoding]::UTF8)

$final = [System.IO.File]::ReadAllLines($htmlFile, [System.Text.Encoding]::UTF8)
Write-Output "PRONTO! Linhas antes: $($htmlLines.Count), depois: $($final.Count)"
