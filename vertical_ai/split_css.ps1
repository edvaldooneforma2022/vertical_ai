$cssFile = "C:\Users\edval\Downloads\css p" + [char]0x00E1 + "gina atual.txt"
$cssLines = [System.IO.File]::ReadAllLines($cssFile, [System.Text.Encoding]::UTF8)

Write-Output "Total linhas CSS: $($cssLines.Count)"

# Parte 1: linhas 1-524 (para aba CSS da Vendd)
$part1 = $cssLines[0..523]
$outFile1 = "C:\Users\edval\Downloads\css_aba_vendd.txt"
[System.IO.File]::WriteAllLines($outFile1, $part1, [System.Text.Encoding]::UTF8)
Write-Output "Parte 1 (aba CSS Vendd): $($part1.Count) linhas -> $outFile1"

# Parte 2: linhas 525-2459 (para dentro do <style> no HTML)
$part2 = $cssLines[524..($cssLines.Count - 1)]
$outFile2 = "C:\Users\edval\Downloads\css_extra_para_html.txt"
[System.IO.File]::WriteAllLines($outFile2, $part2, [System.Text.Encoding]::UTF8)
Write-Output "Parte 2 (para HTML): $($part2.Count) linhas -> $outFile2"

Write-Output "PRONTO!"
