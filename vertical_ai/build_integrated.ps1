# Build script - lê a página principal, insere bloco complementar
$mainFile = (Get-ChildItem 'C:\Users\edval\Downloads\' -Filter '*principal*LK*').FullName
$blockFile = 'C:\Users\edval\vertical_ai\new_block.html'
$scriptFile = 'C:\Users\edval\vertical_ai\new_script.html'
$outputFile = 'C:\Users\edval\Downloads\linkmagic-integrated.html'

$lines = Get-Content $mainFile -Encoding UTF8
$htmlLines = $lines[0..953]

# Remover prefixo "HTML " da primeira linha
if ($htmlLines[0].StartsWith("HTML ")) {
    $htmlLines[0] = $htmlLines[0].Substring(5)
}

# Parte 1: linhas 1-333 (indices 0-332) - até o fim da seção 5
$part1 = $htmlLines[0..332]

# Parte 2: linhas 335-954 (indices 334-953) - seção 6 em diante
$part2 = $htmlLines[334..953]

# Ler os fragmentos
$newBlock = Get-Content $blockFile -Raw -Encoding UTF8
$newScript = Get-Content $scriptFile -Raw -Encoding UTF8

# Montar
$output = ($part1 -join "`r`n") + "`r`n" + $newBlock + "`r`n" + ($part2 -join "`r`n")

# Inserir script antes do </body>
$output = $output.Replace('</body>', $newScript + "`r`n</body>")

[System.IO.File]::WriteAllText($outputFile, $output, (New-Object System.Text.UTF8Encoding $true))

Write-Host "Arquivo criado com sucesso: $outputFile"
$size = (Get-Item $outputFile).Length
Write-Host "Tamanho: $size bytes"
