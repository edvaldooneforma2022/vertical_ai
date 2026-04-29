# ═══════════════════════════════════════════════════════════════════
# QA V15.5 - Knowledge Enforcement Layer
# Testa via shortlink (exatamente como o widget funciona)
# ═══════════════════════════════════════════════════════════════════

$renderBase = "https://vertical-ai-dktu.onrender.com"
$shortCode = "8VCybx"
$conversationId = [guid]::NewGuid().ToString()

# =========================
# RESOLVER SHORTLINK -> PARAMETROS DO WIDGET
# =========================
Write-Host "`n========================="
Write-Host " RESOLVENDO SHORTLINK: /l/$shortCode"
Write-Host "========================="

$apiKey = $null
$widgetUrl = $null
$robotName = $null

# Acessar shortlink e capturar redirect (como o browser faz)
try {
    $resp = Invoke-WebRequest -Uri "$renderBase/l/$shortCode" -UseBasicParsing -MaximumRedirection 5
    $finalUri = $resp.BaseResponse.ResponseUri.ToString()
    $html = $resp.Content
    
    # Extrair parametros do HTML renderizado ou da URL final
    if ($html -match 'apiKey[=:"'']\s*([A-Z0-9_-]{10,})') {
        $apiKey = $matches[1]
    }
    
    # Extrair URL de config do widget no HTML
    if ($html -match 'config\.url\s*=\s*[\"'']([^\"'']+)[\"'']') {
        $widgetUrl = $matches[1]
    }
    if (-not $widgetUrl -and $html -match 'salesUrl[:"''=]\s*(https?[^"''<>\s]+)') {
        $widgetUrl = $matches[1]
    }
    if (-not $widgetUrl -and $html -match 'data-url=[\"'']([^\"'']+)') {
        $widgetUrl = $matches[1]
    }
    
    # Tentar extrair da query string da URL final
    if ($finalUri -match 'apiKey=([^&]+)') {
        if (-not $apiKey) { $apiKey = $matches[1] }
    }
    if ($finalUri -match 'url=([^&]+)') {
        if (-not $widgetUrl) { $widgetUrl = [System.Uri]::UnescapeDataString($matches[1]) }
    }
    if ($finalUri -match 'name=([^&]+)') {
        $robotName = [System.Uri]::UnescapeDataString($matches[1])
    }
    
    Write-Host "  Redirect OK"
} catch {
    Write-Host "  Erro no redirect: $($_.Exception.Message)"
}

# Mostrar dados resolvidos
Write-Host "  Robot: $robotName"
Write-Host "  ApiKey: $($apiKey)"
Write-Host "  WidgetUrl: $widgetUrl"
Write-Host "  ConversationId: $conversationId"

if (-not $apiKey) {
    Write-Host "`n  ERRO FATAL: Nao conseguiu resolver apiKey do shortlink"
    exit 1
}

# =========================
# SCORE
# =========================
$results = [ordered]@{
    produto       = 0
    explicacao    = 0
    objecao       = 0
    compra        = 0
    whatsapp      = 0
    anti_generico = 0
    anti_spam     = 0
}

# =========================
# SEND MESSAGE (como o widget faz)
# =========================
function Send-Message($msg) {
    # Montar body identico ao widget
    $bodyObj = @{
        message        = $msg
        conversationId = $conversationId
        apiKey         = $apiKey
    }
    # Adicionar url apenas se resolvida
    if ($widgetUrl) {
        $bodyObj["url"] = $widgetUrl
    }
    
    $body = $bodyObj | ConvertTo-Json -Depth 5
    $botReply = ""

    try {
        $response = Invoke-RestMethod -Uri "$renderBase/api/process-chat-inteligente" `
            -Method POST `
            -Body $body `
            -ContentType "application/json; charset=utf-8" `
            -Headers @{ "x-api-key" = $apiKey }

        $botReply = $response.response
        if (-not $botReply) { $botReply = $response.text }
        if (-not $botReply) { $botReply = $response.message }
    } catch {
        try {
            $response = Invoke-RestMethod -Uri "$renderBase/api/chat-universal" `
                -Method POST `
                -Body $body `
                -ContentType "application/json; charset=utf-8" `
                -Headers @{ "x-api-key" = $apiKey }
            $botReply = $response.response
        } catch {
            $botReply = "ERRO: $($_.Exception.Message)"
        }
    }

    if (-not $botReply) { $botReply = "(vazio)" }

    Write-Host "  USER: $msg"
    Write-Host "  BOT : $botReply`n"
    return $botReply
}

function IsGeneric($t) { return $t -match "como posso ajudar|deixa eu te explicar melhor|estou aqui para ajudar|posso te ajudar|me diga o que voc" }
function HasCheckout($t) { return $t -match "FINALIZAR COMPRA|checkout|https?://" }
function HasWhats($t) { return $t -match "wa\.me|[Ww]hats[Aa]pp|\+55|whatsapp" }

# =========================
# TESTES
# =========================
Write-Host "`n=== TESTE 1: PRODUTO ==="
$r1 = Send-Message "O que voce vende?"
if ($r1.Length -gt 30 -and -not ($r1 -match "ERRO")) { $results.produto = 10 }

Write-Host "=== TESTE 2: EXPLICACAO ==="
$r2 = Send-Message "Como funciona?"
if ($r2.Length -gt 50 -and -not (IsGeneric $r2) -and -not ($r2 -match "ERRO")) { $results.explicacao = 15 }

Write-Host "=== TESTE 3: OBJECAO ==="
$r3 = Send-Message "Isso parece golpe?"
if (-not (HasCheckout $r3) -and -not ($r3 -match "ERRO")) { $results.objecao = 15 }

Write-Host "=== TESTE 4: COMPRA ==="
$r4 = Send-Message "Quero comprar"
$ckCount = ([regex]::Matches($r4, "FINALIZAR COMPRA")).Count
if ($ckCount -eq 1) { $results.compra = 15 }
elseif (HasCheckout $r4) { $results.compra = 10 }

Write-Host "=== TESTE 5: SUPORTE ==="
$r5 = Send-Message "Quero falar com alguem"
if (HasWhats $r5) { $results.whatsapp = 15 }

Write-Host "=== TESTE 6: ANTI-GENERICO ==="
if (-not (IsGeneric $r1) -and -not (IsGeneric $r2)) { $results.anti_generico = 15 }

Write-Host "=== TESTE 7: ANTI-SPAM ==="
$r6 = Send-Message "Tchau"
if (-not (HasCheckout $r6) -and -not ($r6 -match "ERRO")) { $results.anti_spam = 15 }

# =========================
# RESULTADO
# =========================
$score = ($results.Values | Measure-Object -Sum).Sum

Write-Host "=========================================="
Write-Host " RESULTADO FINAL - QA V15.5 (V15.5 ON)"
Write-Host "=========================================="
$results.GetEnumerator() | ForEach-Object {
    $icon = if ($_.Value -gt 0) { "PASS" } else { "FAIL" }
    Write-Host "  $icon  $($_.Key.PadRight(15)): $($_.Value.ToString().PadLeft(2)) pts"
}
Write-Host "------------------------------------------"
Write-Host "  SCORE: $score / 100"
Write-Host "=========================================="

if ($score -ge 90) { Write-Host "`n  PRONTO PRA ESCALAR" }
elseif ($score -ge 70) { Write-Host "`n  Vende, mas ajustar fino" }
else { Write-Host "`n  Ainda instavel" }
Write-Host ""
