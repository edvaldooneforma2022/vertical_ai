$src = "C:\Users\edval\Downloads\melhorar p" + [char]0x00E1 + "gina.txt.bak"
$dst = "C:\Users\edval\Downloads\melhorar p" + [char]0x00E1 + "gina.txt"
Copy-Item $src $dst -Force
Write-Output "Restaurado!"
$lines = [System.IO.File]::ReadAllLines($dst, [System.Text.Encoding]::UTF8)
Write-Output "Total linhas: $($lines.Count)"
