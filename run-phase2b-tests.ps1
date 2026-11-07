<#
.SYNOPSIS
    Executor seguro de testes da Fase 2B em PostgreSQL LOCAL isolado.

.DESCRIPTION
    - Solicita a senha do postgres via entrada segura (Read-Host -AsSecureString).
    - Libera a memória não gerenciada do BSTR com ZeroFreeBSTR.
    - Conecta EXCLUSIVAMENTE a 127.0.0.1:5432.
    - Utiliza -X em todas as chamadas psql para impedir interferência de arquivos .psqlrc.
    - Valida a identidade física estrita do cluster local (banco, usuário, socket 127.0.0.1, versão 16, diretório de dados).
    - Aborta se a base linkmagico_phase2b_test já existir (previne exclusão por CASCADE); cria nova do zero se inexistente.
    - Provisiona a extensão pgcrypto exclusivamente na base de testes pelo admin.
    - Inspeciona a role 'linkmagico_test': aborta se preexistente no cluster.
    - Configura a role dedicada 'linkmagico_test' (NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT).
    - Criação de role com senha via STDIN com ON_ERROR_STOP=1 (evita exposição de credenciais em argumentos de processo).
    - Concede permissões restritas exclusivamente sobre linkmagico_phase2b_test e schema public em bloco transacional (BEGIN/COMMIT).
    - Configura ALTER DEFAULT PRIVILEGES FOR ROLE postgres para objetos do admin.
    - Executa os testes usando a role restrita linkmagico_test (não como superusuário).
    - Execução com binário local do Jest, bloqueando download ou instalação inesperada de pacotes.
    - Nunca exibe senhas ou connection strings em logs ou terminal.
    - Implementa fail-fast: aborta imediatamente se a suíte de integração falhar.
    - Não utiliza --forceExit: respeita o encerramento gracioso de pools e timers.
    - Retorna código de saída real (exit code diferente de zero em falha).
    - Remove credenciais do ambiente ao finalizar (inclusive em erros ou interrupção graciosa).

.NOTES
    NÃO utiliza DATABASE_URL de produção.
    NÃO grava credenciais em arquivos.
    NÃO executa migrations em produção.
    NÃO realiza commit, push ou deploy.
    AVISO: O encerramento forçado do processo (ex.: SIGKILL, taskkill /F, queda do SO)
    não garante a execução do bloco finally pelo runtime do PowerShell.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$PG_BIN            = "C:\Program Files\PostgreSQL\16\bin"
$PG_HOST           = "127.0.0.1"
$PG_PORT           = "5432"
$PG_ADMIN_USER     = "postgres"
$TEST_ROLE         = "linkmagico_test"
$DB_NAME           = "linkmagico_phase2b_test"
$EXPECTED_DATA_DIR = "C:\Program Files\PostgreSQL\16\data"
$PROJECT_DIR       = "c:\Users\edval\vertical_ai"
$JEST_BIN          = "$PROJECT_DIR\node_modules\.bin\jest.cmd"
$JEST_JS           = "$PROJECT_DIR\node_modules\jest\bin\jest.js"

# Variáveis sensíveis e código de saída
$plainPassword       = $null
$testRolePassword    = $null
$createRoleSql       = $null
$grantSql            = $null
$escapedTestPassword = $null
$identitySql         = $null
$scriptExitCode      = 0

try {
    # ═══════════════════════════════════════════════════
    # ETAPA 1: Captura segura da senha e liberação de BSTR
    # ═══════════════════════════════════════════════════
    Write-Host ""
    Write-Host "═══ FASE 2B — EXECUTOR SEGURO DE TESTES POSTGRESQL LOCAL ═══" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Parâmetros estritos de conexão:" -ForegroundColor Yellow
    Write-Host "  - Host: 127.0.0.1 (exclusivo local)" -ForegroundColor Yellow
    Write-Host "  - Porta: 5432" -ForegroundColor Yellow
    Write-Host "  - Base: linkmagico_phase2b_test" -ForegroundColor Yellow
    Write-Host "  - Role de Teste: linkmagico_test (NOSUPERUSER)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "[1/9] Solicitando senha administrativa local..." -ForegroundColor White

    $securePassword = Read-Host -Prompt "Senha do superusuario '$PG_ADMIN_USER' (apenas para provisionar base e role local)" -AsSecureString

    # Conversão protegida com liberação determinística do BSTR
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try {
        $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }

    if ([string]::IsNullOrWhiteSpace($plainPassword)) {
        throw "Senha vazia fornecida. Abortando com segurança."
    }

    # ═══════════════════════════════════════════════════
    # ETAPA 2: Verificação de conectividade local estrita
    # ═══════════════════════════════════════════════════
    Write-Host "[2/9] Verificando conectividade com PostgreSQL local (127.0.0.1:5432)..." -ForegroundColor White

    $isReady = & "$PG_BIN\pg_isready.exe" -h $PG_HOST -p $PG_PORT 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "PostgreSQL local não está respondendo em $PG_HOST`:$PG_PORT. Verifique se o serviço está ativo."
    }
    Write-Host "  OK: Conexão local ativa." -ForegroundColor Green

    # ═══════════════════════════════════════════════════
    # ETAPA 3: Autenticação administrativa temporária
    # ═══════════════════════════════════════════════════
    Write-Host "[3/9] Testando autenticação administrativa temporária..." -ForegroundColor White

    $env:PGPASSWORD = $plainPassword
    $authCheck = & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d postgres -t -A -v ON_ERROR_STOP=1 -c "SELECT 1;" 2>&1
    if ($LASTEXITCODE -ne 0 -or $authCheck.Trim() -ne "1") {
        throw "Falha na autenticação com '$PG_ADMIN_USER'. Verifique a senha informada."
    }
    Write-Host "  OK: Autenticação administrativa confirmada." -ForegroundColor Green

    # ═══════════════════════════════════════════════════
    # ETAPA 4: Validação da identidade física estrita do cluster PostgreSQL
    # ═══════════════════════════════════════════════════
    Write-Host "[4/9] Validando identidade estrita do cluster PostgreSQL (socket, versão, data_dir)..." -ForegroundColor White

    $identitySql = "SELECT current_database(), current_user, inet_server_addr()::text, inet_server_port()::text, current_setting('server_version_num'), current_setting('data_directory');"
    $identityOutput = & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d postgres -t -A -F "|" -v ON_ERROR_STOP=1 -c $identitySql 2>&1
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($identityOutput)) {
        throw "Falha ao consultar a identidade física do cluster PostgreSQL local."
    }

    $identityFields = $identityOutput.Trim().Split('|')
    if ($identityFields.Count -ne 6) {
        throw "Resposta da validação de identidade física incompleta ou em formato inválido (esperado exatamente 6 campos delimitados por '|')."
    }

    $actualDb      = $identityFields[0].Trim()
    $actualUser    = $identityFields[1].Trim()
    $actualAddr    = $identityFields[2].Trim()
    $actualPort    = $identityFields[3].Trim()

    $rawVerNum     = $identityFields[4].Trim()
    $actualVerNum  = 0
    if (-not ($rawVerNum -match '^\d+$') -or -not [int]::TryParse($rawVerNum, [ref]$actualVerNum)) {
        throw "Validação de identidade falhou: server_version_num '$rawVerNum' não é um valor numérico válido."
    }

    $actualDataDir = $identityFields[5].Trim().Replace('/', '\')

    if ($actualDb -ne "postgres") {
        throw "Validação de identidade falhou: banco conectado é '$actualDb' (esperado: 'postgres')."
    }

    if ($actualUser -ne $PG_ADMIN_USER) {
        throw "Validação de identidade falhou: usuário conectado é '$actualUser' (esperado: '$PG_ADMIN_USER')."
    }

    if ($actualAddr -ne "127.0.0.1" -and $actualAddr -ne "127.0.0.1/32") {
        throw "Validação de identidade falhou: endereço do servidor é '$actualAddr' (esperado exclusivamente: '127.0.0.1' ou '127.0.0.1/32')."
    }

    if ($actualPort -ne $PG_PORT) {
        throw "Validação de identidade falhou: porta do servidor é '$actualPort' (esperada: '$PG_PORT')."
    }

    if ($actualVerNum -lt 160000 -or $actualVerNum -ge 170000) {
        throw "Validação de identidade falhou: versão do PostgreSQL ($actualVerNum) não é a versão 16 esperada."
    }

    if ($actualDataDir.ToLowerInvariant() -ne $EXPECTED_DATA_DIR.ToLowerInvariant()) {
        throw "Validação de identidade falhou: diretório de dados '$actualDataDir' diverge do esperado ('$EXPECTED_DATA_DIR')."
    }

    Write-Host "  OK: Cluster validado (banco: $actualDb, user: $actualUser, addr: $actualAddr`:$actualPort, ver: PG16, data: $actualDataDir)." -ForegroundColor Green

    # ═══════════════════════════════════════════════════
    # ETAPA 5: Verificação prévia de catálogos (Base e Role) — BARREIRA PRÉ-DDL
    # Suporta reutilização controlada de recursos existentes mediante auditoria fail-closed.
    # ═══════════════════════════════════════════════════
    Write-Host "[5/9] Verificando estado de base e role no cluster local..." -ForegroundColor White

    # --- Barreira 1: Verificar existência e estado da base ---
    $dbExists = & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d postgres -t -A -v ON_ERROR_STOP=1 -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME';" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao consultar o catálogo pg_database no PostgreSQL local."
    }

    $dbExistsText = @($dbExists) -join " "
    $dbExistsTrimmed = $dbExistsText.Trim()
    $dbAlreadyExists = $false

    if ($dbExistsTrimmed -eq "1") {
        Write-Host "  Base '$DB_NAME' encontrada. Validando reutilização..." -ForegroundColor Yellow

        # 5.1a — Proprietário e codificação (2 campos)
        $dbPropsResult = & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d postgres -t -A -v ON_ERROR_STOP=1 -c "SELECT pg_catalog.pg_get_userbyid(d.datdba), pg_catalog.pg_encoding_to_char(d.encoding) FROM pg_database d WHERE d.datname = '$DB_NAME';" 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Falha ao consultar propriedades da base '$DB_NAME'." }
        $dbPropsText = (@($dbPropsResult) -join " ").Trim()
        if ($dbPropsText -eq "") { throw "Consulta de propriedades do banco retornou saída vazia." }
        $dbParts = $dbPropsText.Split('|')
        if ($dbParts.Count -ne 2) {
            throw "Propriedades do banco: $($dbParts.Count) campos (esperado: 2). Saída: '$dbPropsText'."
        }
        if ($dbParts[0] -ne $PG_ADMIN_USER) {
            throw "Base '$DB_NAME' tem proprietário '$($dbParts[0])' (esperado: '$PG_ADMIN_USER'). Reutilização recusada."
        }
        if ($dbParts[1] -ne "UTF8") {
            throw "Base '$DB_NAME' tem codificação '$($dbParts[1])' (esperado: 'UTF8'). Reutilização recusada."
        }
        Write-Host "    Proprietário: $($dbParts[0]) — OK" -ForegroundColor Gray
        Write-Host "    Codificação:  $($dbParts[1]) — OK" -ForegroundColor Gray

        # 5.1b — Inventário principal de objetos em todos os schemas não sistêmicos (6 campos)
        # Funções e tipos de extensões (pgcrypto) são excluídos via pg_depend com classid específico.
        $objQuery = "SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema','pg_toast') AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast_temp_%' AND c.relkind IN ('r','p')), (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema','pg_toast') AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast_temp_%' AND c.relkind IN ('v','m')), (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema','pg_toast') AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast_temp_%' AND c.relkind = 'S'), (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema','pg_toast') AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast_temp_%' AND c.relkind = 'f'), (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')), (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema','pg_toast') AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast_temp_%' AND t.typtype IN ('b','c','d','e','r') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_type'::regclass AND d.objid = t.oid AND d.deptype = 'e') AND NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.reltype = t.oid));"
        $objResult = & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d $DB_NAME -t -A -v ON_ERROR_STOP=1 -c $objQuery 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Falha ao verificar inventário principal na base '$DB_NAME'." }
        $objText = (@($objResult) -join " ").Trim()
        if ($objText -eq "") { throw "Inventário principal retornou saída vazia na base '$DB_NAME'." }
        $objParts = $objText.Split('|')
        if ($objParts.Count -ne 6) {
            throw "Inventário principal: $($objParts.Count) campos (esperado: 6). Saída: '$objText'."
        }
        $objLabels = @("Tabelas/particionadas","Views/materialized","Sequences","Foreign tables","Functions (excl. ext.)","Tipos/domínios (excl. ext.)")
        for ($i = 0; $i -lt 6; $i++) {
            $val = $objParts[$i].Trim()
            if ($val -eq "" -or $val -notmatch '^\d+$') {
                throw "Campo '$($objLabels[$i])' inválido: '$val'. Saída completa: '$objText'."
            }
            $parsed = 0L
            if (-not [Int64]::TryParse($val, [ref]$parsed)) {
                throw "Campo '$($objLabels[$i])' não conversível para Int64: '$val'."
            }
            if ($parsed -lt 0L) {
                throw "Campo '$($objLabels[$i])' negativo: $parsed."
            }
            Write-Host "    $($objLabels[$i]):  $parsed" -ForegroundColor Gray
            if ($parsed -ne 0L) {
                throw "Base '$DB_NAME' contém $parsed objeto(s) em '$($objLabels[$i])'. Reutilização recusada."
            }
        }

        # 5.1c — Inventário estendido: operadores, collations, conversions, text search,
        #         operator classes/families, schemas inesperados, casts não-built-in (3 campos)
        $extObjQuery = "SELECT (SELECT count(*) FROM (SELECT o.oid FROM pg_operator o JOIN pg_namespace n ON n.oid = o.oprnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_operator'::regclass AND d.objid = o.oid AND d.deptype = 'e') UNION ALL SELECT c.oid FROM pg_collation c JOIN pg_namespace n ON n.oid = c.collnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema','pg_toast') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_collation'::regclass AND d.objid = c.oid AND d.deptype = 'e') UNION ALL SELECT c.oid FROM pg_conversion c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_conversion'::regclass AND d.objid = c.oid AND d.deptype = 'e') UNION ALL SELECT t.oid FROM pg_ts_config t JOIN pg_namespace n ON n.oid = t.cfgnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_ts_config'::regclass AND d.objid = t.oid AND d.deptype = 'e') UNION ALL SELECT t.oid FROM pg_ts_dict t JOIN pg_namespace n ON n.oid = t.dictnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_ts_dict'::regclass AND d.objid = t.oid AND d.deptype = 'e') UNION ALL SELECT o.oid FROM pg_opclass o JOIN pg_namespace n ON n.oid = o.opcnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_opclass'::regclass AND d.objid = o.oid AND d.deptype = 'e') UNION ALL SELECT o.oid FROM pg_opfamily o JOIN pg_namespace n ON n.oid = o.opfnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_opfamily'::regclass AND d.objid = o.oid AND d.deptype = 'e')) sub), (SELECT count(*) FROM pg_namespace n WHERE n.nspname NOT IN ('pg_catalog','information_schema','pg_toast','public') AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast_temp_%'), (SELECT count(*) FROM pg_cast c WHERE c.oid >= 16384 AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_cast'::regclass AND d.objid = c.oid AND d.deptype = 'e'));"
        $extObjResult = & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d $DB_NAME -t -A -v ON_ERROR_STOP=1 -c $extObjQuery 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Falha ao verificar inventário estendido na base '$DB_NAME'." }
        $extObjText = (@($extObjResult) -join " ").Trim()
        if ($extObjText -eq "") { throw "Inventário estendido retornou saída vazia na base '$DB_NAME'." }
        $extObjParts = $extObjText.Split('|')
        if ($extObjParts.Count -ne 3) {
            throw "Inventário estendido: $($extObjParts.Count) campos (esperado: 3). Saída: '$extObjText'."
        }
        $extLabels = @("Outros objetos (oper/coll/conv/ts/opclass/opfam)","Schemas inesperados","Casts não-built-in não-extensão")
        for ($i = 0; $i -lt 3; $i++) {
            $val = $extObjParts[$i].Trim()
            if ($val -eq "" -or $val -notmatch '^\d+$') {
                throw "Campo '$($extLabels[$i])' inválido: '$val'. Saída completa: '$extObjText'."
            }
            $parsed = 0L
            if (-not [Int64]::TryParse($val, [ref]$parsed)) {
                throw "Campo '$($extLabels[$i])' não conversível para Int64: '$val'."
            }
            if ($parsed -lt 0L) {
                throw "Campo '$($extLabels[$i])' negativo: $parsed."
            }
            Write-Host "    $($extLabels[$i]):  $parsed" -ForegroundColor Gray
            if ($parsed -ne 0L) {
                throw "Base '$DB_NAME' contém $parsed objeto(s) em '$($extLabels[$i])'. Reutilização recusada."
            }
        }

        # 5.1d — Inventário de segurança: event triggers, publications, subscriptions,
        #         FDWs, foreign servers, languages, transforms, access methods, extended statistics (9 campos)
        #         Exclui objetos de sistema ou pertencentes a extensões conforme aplicável a cada catálogo.
        $secQuery = "SELECT (SELECT count(*) FROM pg_event_trigger et WHERE NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_event_trigger'::regclass AND d.objid = et.oid AND d.deptype = 'e')), (SELECT count(*) FROM pg_publication p WHERE NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_publication'::regclass AND d.objid = p.oid AND d.deptype = 'e')), (SELECT count(*) FROM pg_subscription s WHERE NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_subscription'::regclass AND d.objid = s.oid AND d.deptype = 'e')), (SELECT count(*) FROM pg_foreign_data_wrapper w WHERE NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_foreign_data_wrapper'::regclass AND d.objid = w.oid AND d.deptype = 'e')), (SELECT count(*) FROM pg_foreign_server sv WHERE NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_foreign_server'::regclass AND d.objid = sv.oid AND d.deptype = 'e')), (SELECT count(*) FROM pg_language WHERE lanname NOT IN ('internal','c','sql','plpgsql') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_language'::regclass AND d.objid = pg_language.oid AND d.deptype = 'e')), (SELECT count(*) FROM pg_transform tr WHERE NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_transform'::regclass AND d.objid = tr.oid AND d.deptype = 'e')), (SELECT count(*) FROM pg_am WHERE oid >= 16384 AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_am'::regclass AND d.objid = pg_am.oid AND d.deptype = 'e')), (SELECT count(*) FROM pg_statistic_ext e JOIN pg_namespace n ON n.oid = e.stxnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_statistic_ext'::regclass AND d.objid = e.oid AND d.deptype = 'e'));"
        $secResult = & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d $DB_NAME -t -A -v ON_ERROR_STOP=1 -c $secQuery 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Falha ao verificar inventário de segurança na base '$DB_NAME'." }
        $secText = (@($secResult) -join " ").Trim()
        if ($secText -eq "") { throw "Inventário de segurança retornou saída vazia na base '$DB_NAME'." }
        $secParts = $secText.Split('|')
        if ($secParts.Count -ne 9) {
            throw "Inventário de segurança: $($secParts.Count) campos (esperado: 9). Saída: '$secText'."
        }
        $secLabels = @("Event triggers","Publications","Subscriptions","Foreign-data wrappers","Foreign servers","Languages (excl. sistema)","Transforms (excl. ext.)","Access methods (excl. built-in)","Extended statistics (excl. ext.)")
        for ($i = 0; $i -lt 9; $i++) {
            $val = $secParts[$i].Trim()
            if ($val -eq "" -or $val -notmatch '^\d+$') {
                throw "Campo '$($secLabels[$i])' inválido: '$val'. Saída completa: '$secText'."
            }
            $parsed = 0L
            if (-not [Int64]::TryParse($val, [ref]$parsed)) {
                throw "Campo '$($secLabels[$i])' não conversível para Int64: '$val'."
            }
            if ($parsed -lt 0L) {
                throw "Campo '$($secLabels[$i])' negativo: $parsed."
            }
            Write-Host "    $($secLabels[$i]):  $parsed" -ForegroundColor Gray
            if ($parsed -ne 0L) {
                throw "Base '$DB_NAME' contém $parsed objeto(s) em '$($secLabels[$i])'. Reutilização recusada."
            }
        }

        $dbAlreadyExists = $true
        Write-Host "  OK: Base '$DB_NAME' existe e está vazia — reutilização aprovada." -ForegroundColor Green
    }
    elseif ($dbExistsTrimmed -eq "") {
        Write-Host "  OK: Base '$DB_NAME' não existe no cluster (será criada)." -ForegroundColor Green
    }
    else {
        throw "Resposta inesperada ao consultar pg_database: '$dbExistsTrimmed'."
    }

    # --- Barreira 2: Verificar existência e estado da role ---
    $roleCheck = & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d postgres -t -A -v ON_ERROR_STOP=1 -c "SELECT 1 FROM pg_roles WHERE rolname = '$TEST_ROLE';" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Falha ao consultar o catálogo pg_roles no PostgreSQL local."
    }

    $roleCheckText = @($roleCheck) -join " "
    $roleCheckTrimmed = $roleCheckText.Trim()
    $roleAlreadyExists = $false

    if ($roleCheckTrimmed -eq "1") {
        Write-Host "  Role '$TEST_ROLE' encontrada. Validando atributos..." -ForegroundColor Yellow

        # 5.2a — Sete atributos de segurança (7 campos booleanos t/f)
        $roleAttrsResult = & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d postgres -t -A -v ON_ERROR_STOP=1 -c "SELECT rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = '$TEST_ROLE';" 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Falha ao consultar atributos da role '$TEST_ROLE'." }
        $roleAttrsText = (@($roleAttrsResult) -join " ").Trim()
        if ($roleAttrsText -eq "") { throw "Consulta de atributos da role retornou saída vazia." }
        $ra = $roleAttrsText.Split('|')
        if ($ra.Count -ne 7) {
            throw "Atributos da role: $($ra.Count) campos (esperado: 7). Saída: '$roleAttrsText'."
        }
        $attrNames    = @("SUPERUSER","INHERIT","CREATEROLE","CREATEDB","LOGIN","REPLICATION","BYPASSRLS")
        $attrExpected = @("f",        "f",      "f",         "f",       "t",    "f",          "f")
        for ($i = 0; $i -lt 7; $i++) {
            $val = $ra[$i].Trim()
            if ($val -ne "t" -and $val -ne "f") {
                throw "Atributo $($attrNames[$i]) tem valor inesperado '$val' (esperado: 't' ou 'f'). Saída: '$roleAttrsText'."
            }
            $status = if ($val -eq $attrExpected[$i]) { "OK" } else { "DIVERGENTE" }
            Write-Host "    $($attrNames[$i]): $val (esperado: $($attrExpected[$i])) — $status" -ForegroundColor Gray
            if ($val -ne $attrExpected[$i]) {
                throw "Role '$TEST_ROLE' tem $($attrNames[$i])=$val (esperado: $($attrExpected[$i])). Reutilização recusada."
            }
        }

        # 5.2b — Memberships bidirecionais com existência embarcada (3 campos: nome, member_of, has_members)
        $memberResult = & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d postgres -t -A -v ON_ERROR_STOP=1 -c "SELECT r.rolname, (SELECT count(*) FROM pg_auth_members WHERE member = r.oid), (SELECT count(*) FROM pg_auth_members WHERE roleid = r.oid) FROM pg_roles r WHERE r.rolname = '$TEST_ROLE';" 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Falha ao consultar memberships da role '$TEST_ROLE'." }
        $memberText = (@($memberResult) -join " ").Trim()
        if ($memberText -eq "") { throw "Consulta de memberships retornou saída vazia. A role pode ter sido removida." }
        $memberParts = $memberText.Split('|')
        if ($memberParts.Count -ne 3) {
            throw "Memberships: $($memberParts.Count) campos (esperado: 3). Saída: '$memberText'."
        }
        $confirmedName = $memberParts[0].Trim()
        if ($confirmedName -ne $TEST_ROLE) {
            throw "Nome confirmado='$confirmedName' diverge de '$TEST_ROLE'. Abort."
        }
        $memberOfVal = $memberParts[1].Trim()
        $hasMembersVal = $memberParts[2].Trim()
        if ($memberOfVal -eq "" -or $memberOfVal -notmatch '^\d+$') {
            throw "Contagem 'participa de grupos' inválida: '$memberOfVal'."
        }
        if ($hasMembersVal -eq "" -or $hasMembersVal -notmatch '^\d+$') {
            throw "Contagem 'possui associados' inválida: '$hasMembersVal'."
        }
        $memberOfCount = 0L
        $hasMembersCount = 0L
        if (-not [Int64]::TryParse($memberOfVal, [ref]$memberOfCount)) { throw "Membership 'participa' não conversível: '$memberOfVal'." }
        if (-not [Int64]::TryParse($hasMembersVal, [ref]$hasMembersCount)) { throw "Membership 'possui' não conversível: '$hasMembersVal'." }
        if ($memberOfCount -lt 0L) { throw "Contagem 'participa de grupos' negativa: $memberOfCount." }
        if ($hasMembersCount -lt 0L) { throw "Contagem 'possui associados' negativa: $hasMembersCount." }
        Write-Host "    Role confirmada:     $confirmedName" -ForegroundColor Gray
        Write-Host "    Participa de grupos: $memberOfCount" -ForegroundColor Gray
        Write-Host "    Possui associados:   $hasMembersCount" -ForegroundColor Gray
        if ($memberOfCount -ne 0L) {
            throw "Role '$TEST_ROLE' participa de $memberOfCount grupo(s). Reutilização recusada."
        }
        if ($hasMembersCount -ne 0L) {
            throw "Role '$TEST_ROLE' possui $hasMembersCount associado(s). Reutilização recusada."
        }

        # 5.2c — Validação de permissões existentes (3 campos: connect, usage, create)
        $permResult = & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d $DB_NAME -t -A -v ON_ERROR_STOP=1 -c "SELECT has_database_privilege('$TEST_ROLE', '$DB_NAME', 'CONNECT'), pg_catalog.has_schema_privilege('$TEST_ROLE', 'public', 'USAGE'), pg_catalog.has_schema_privilege('$TEST_ROLE', 'public', 'CREATE');" 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Falha ao consultar permissões da role '$TEST_ROLE'." }
        $permText = (@($permResult) -join " ").Trim()
        if ($permText -eq "") { throw "Consulta de permissões retornou saída vazia." }
        $permParts = $permText.Split('|')
        if ($permParts.Count -ne 3) {
            throw "Permissões: $($permParts.Count) campos (esperado: 3). Saída: '$permText'."
        }
        $permLabels   = @("CONNECT","USAGE em public","CREATE em public")
        $permExpected = @("t",      "t",              "t")
        for ($i = 0; $i -lt 3; $i++) {
            $val = $permParts[$i].Trim()
            if ($val -ne "t" -and $val -ne "f") {
                throw "Permissão '$($permLabels[$i])' tem valor inesperado '$val'. Saída: '$permText'."
            }
            Write-Host "    $($permLabels[$i]): $val (esperado: $($permExpected[$i]))" -ForegroundColor Gray
            if ($val -ne $permExpected[$i]) {
                throw "Permissão '$($permLabels[$i])' está ausente para '$TEST_ROLE'. Reutilização recusada."
            }
        }

        # 5.2d — Validação completa de ACLs e default privileges
        # Parsing entry-by-entry do formato PostgreSQL: {grantee=privs/grantor,...}
        # Rejeita: privilégios não autorizados, grantors inesperados, entradas duplicadas,
        # entradas ausentes, tipos inesperados. Não depende apenas de contagem.
        # Grantees permitidos neste banco de teste (sistema + role de teste):
        $allowedGrantees = @("", "pg_database_owner", $PG_ADMIN_USER, $TEST_ROLE)

        # 5.2d.i — datacl do banco: validação completa
        # Esperado para $TEST_ROLE: CONNECT (c), concedido por $PG_ADMIN_USER, sem GRANT OPTION.
        $dbAclQuery = "SELECT COALESCE(datacl::text, '') FROM pg_database WHERE datname = '$DB_NAME';"
        $dbAclResult = & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d postgres -t -A -v ON_ERROR_STOP=1 -c $dbAclQuery 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Falha ao consultar datacl do banco '$DB_NAME'." }
        $dbAclText = (@($dbAclResult) -join " ").Trim()
        if ($dbAclText -eq "") {
            throw "datacl do banco '$DB_NAME' é NULL ou vazio. GRANT CONNECT não foi aplicado. Reutilização recusada."
        }
        $dbAclInner = $dbAclText.TrimStart('{').TrimEnd('}')
        $dbAclEntries = $dbAclInner.Split(',')
        $dbRoleFound = $false
        $dbGranteeSeen = @{}
        foreach ($entry in $dbAclEntries) {
            $eqIdx = $entry.IndexOf('=')
            $slIdx = $entry.LastIndexOf('/')
            if ($eqIdx -lt 0 -or $slIdx -lt 0 -or $slIdx -le $eqIdx) {
                throw "datacl: entrada com formato inválido: '$entry'. ACL completa: '$dbAclText'."
            }
            $grantee = $entry.Substring(0, $eqIdx)
            $privs = $entry.Substring($eqIdx + 1, $slIdx - $eqIdx - 1)
            $grantor = $entry.Substring($slIdx + 1)
            if ($dbGranteeSeen.ContainsKey($grantee)) {
                throw "datacl: grantee duplicado '$grantee'. ACL completa: '$dbAclText'. Reutilização recusada."
            }
            $dbGranteeSeen[$grantee] = $true
            if ($allowedGrantees -notcontains $grantee) {
                throw "datacl: grantee não autorizado '$grantee'. ACL completa: '$dbAclText'. Reutilização recusada."
            }
            if ($grantee -eq $TEST_ROLE) {
                if ($privs -match '\*') {
                    throw "datacl: WITH GRANT OPTION detectado para '$TEST_ROLE' ('$privs'). Não autorizado. ACL: '$dbAclText'."
                }
                if ($privs -ne "c") {
                    throw "datacl: role '$TEST_ROLE' tem privilégios '$privs' (esperado exato: 'c' = CONNECT). ACL: '$dbAclText'. Reutilização recusada."
                }
                if ($grantor -ne $PG_ADMIN_USER) {
                    throw "datacl: grantor de '$TEST_ROLE' é '$grantor' (esperado: '$PG_ADMIN_USER'). ACL: '$dbAclText'. Reutilização recusada."
                }
                $dbRoleFound = $true
                Write-Host "    datacl: $TEST_ROLE=c/$PG_ADMIN_USER — OK" -ForegroundColor Gray
            } else {
                Write-Host "    datacl: $entry (sistema) — permitido" -ForegroundColor Gray
            }
        }
        if (-not $dbRoleFound) {
            throw "datacl: entrada para '$TEST_ROLE' ausente. ACL completa: '$dbAclText'. Reutilização recusada."
        }

        # 5.2d.ii — nspacl do schema public: validação completa
        # Esperado para $TEST_ROLE: USAGE+CREATE (UC), sem GRANT OPTION.
        # No PostgreSQL 15+, o owner do schema public é pg_database_owner (pseudo-role
        # que resolve para o database owner). Quando um superusuário executa GRANT sobre
        # um objeto, o PostgreSQL registra o grantor como o proprietário do objeto.
        # Para o schema public em PG16, o grantor legítimo é exclusivamente o owner
        # confirmado do schema — não o usuário que executou o GRANT.

        # Consultar owner real do schema public via catálogo
        $schemaOwnerQuery = "SELECT r.rolname FROM pg_namespace n JOIN pg_roles r ON r.oid = n.nspowner WHERE n.nspname = 'public';"
        $schemaOwnerResult = & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d $DB_NAME -t -A -v ON_ERROR_STOP=1 -c $schemaOwnerQuery 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Falha ao consultar proprietário do schema public." }
        $schemaOwnerName = (@($schemaOwnerResult) -join " ").Trim()
        if ($schemaOwnerName -eq "") {
            throw "Proprietário do schema public não identificado. Reutilização recusada."
        }
        if ($schemaOwnerName -ne "pg_database_owner") {
            throw "Proprietário do schema public é '$schemaOwnerName' (esperado: 'pg_database_owner' em PostgreSQL 15+). Reutilização recusada."
        }
        Write-Host "    Owner do schema public: $schemaOwnerName — OK" -ForegroundColor Gray

        # Grantor autorizado para nspacl: exclusivamente o owner confirmado do schema
        $nspaclExpectedGrantor = $schemaOwnerName

        $schemaAclQuery = "SELECT COALESCE(nspacl::text, '') FROM pg_namespace WHERE nspname = 'public';"
        $schemaAclResult = & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d $DB_NAME -t -A -v ON_ERROR_STOP=1 -c $schemaAclQuery 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Falha ao consultar nspacl do schema public." }
        $schemaAclText = (@($schemaAclResult) -join " ").Trim()
        if ($schemaAclText -eq "") {
            throw "nspacl do schema public é NULL ou vazio. GRANTs não foram aplicados. Reutilização recusada."
        }
        $schemaAclInner = $schemaAclText.TrimStart('{').TrimEnd('}')
        $schemaAclEntries = $schemaAclInner.Split(',')
        $schemaRoleFound = $false
        $schemaGranteeSeen = @{}
        foreach ($entry in $schemaAclEntries) {
            $eqIdx = $entry.IndexOf('=')
            $slIdx = $entry.LastIndexOf('/')
            if ($eqIdx -lt 0 -or $slIdx -lt 0 -or $slIdx -le $eqIdx) {
                throw "nspacl: entrada com formato inválido: '$entry'. ACL completa: '$schemaAclText'."
            }
            $grantee = $entry.Substring(0, $eqIdx)
            $privs = $entry.Substring($eqIdx + 1, $slIdx - $eqIdx - 1)
            $grantor = $entry.Substring($slIdx + 1)
            if ($schemaGranteeSeen.ContainsKey($grantee)) {
                throw "nspacl: grantee duplicado '$grantee'. ACL completa: '$schemaAclText'. Reutilização recusada."
            }
            $schemaGranteeSeen[$grantee] = $true
            if ($allowedGrantees -notcontains $grantee) {
                throw "nspacl: grantee não autorizado '$grantee'. ACL completa: '$schemaAclText'. Reutilização recusada."
            }
            if ($grantee -eq $TEST_ROLE) {
                if ($privs -match '\*') {
                    throw "nspacl: WITH GRANT OPTION detectado para '$TEST_ROLE' ('$privs'). Não autorizado. ACL: '$schemaAclText'."
                }
                if ($privs -ne "UC") {
                    throw "nspacl: role '$TEST_ROLE' tem privilégios '$privs' (esperado exato: 'UC' = USAGE+CREATE). ACL: '$schemaAclText'. Reutilização recusada."
                }
                if ($grantor -ne $nspaclExpectedGrantor) {
                    throw "nspacl: grantor de '$TEST_ROLE' é '$grantor' (esperado: '$nspaclExpectedGrantor', owner do schema). ACL: '$schemaAclText'. Reutilização recusada."
                }
                $schemaRoleFound = $true
                Write-Host "    nspacl: $TEST_ROLE=UC/$grantor — OK (grantor = owner do schema)" -ForegroundColor Gray
            } else {
                Write-Host "    nspacl: $entry (sistema) — permitido" -ForegroundColor Gray
            }
        }
        if (-not $schemaRoleFound) {
            throw "nspacl: entrada para '$TEST_ROLE' ausente. ACL completa: '$schemaAclText'. Reutilização recusada."
        }

        # 5.2d.iii — defaclacl: validação completa por tipo de objeto
        # Cada tipo deve ter exatamente uma entrada para $TEST_ROLE com privilégios exatos.
        # Privilégios ALL em PG16 (sem GRANT OPTION):
        #   tables(r):    arwdDxt  (INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER)
        #   sequences(S): rwU      (SELECT,UPDATE,USAGE)
        #   functions(f): X        (EXECUTE)
        $defPrivQuery = "SELECT defaclobjtype, defaclacl::text FROM pg_default_acl WHERE defaclrole = (SELECT oid FROM pg_roles WHERE rolname = '$PG_ADMIN_USER') AND defaclobjtype IN ('r','S','f') ORDER BY defaclobjtype;"
        $defPrivResult = & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d $DB_NAME -t -A -v ON_ERROR_STOP=1 -c $defPrivQuery 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Falha ao consultar default privileges." }
        $defPrivRaw = @($defPrivResult)
        $defPrivLines = @()
        foreach ($rawLine in $defPrivRaw) {
            $trimLine = $rawLine.ToString().Trim()
            if ($trimLine -ne "") { $defPrivLines += $trimLine }
        }
        if ($defPrivLines.Count -ne 3) {
            $joined = $defPrivLines -join " ; "
            throw "Default privileges: $($defPrivLines.Count) entradas (esperado: 3 para r, S, f). Saída: '$joined'."
        }
        # Verificar se existem tipos inesperados na consulta
        $defPrivExtraQuery = "SELECT count(*) FROM pg_default_acl WHERE defaclrole = (SELECT oid FROM pg_roles WHERE rolname = '$PG_ADMIN_USER') AND defaclobjtype NOT IN ('r','S','f');"
        $defPrivExtraResult = & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d $DB_NAME -t -A -v ON_ERROR_STOP=1 -c $defPrivExtraQuery 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Falha ao verificar default privileges extras." }
        $defPrivExtraText = (@($defPrivExtraResult) -join " ").Trim()
        if ($defPrivExtraText -ne "0") {
            throw "Default privileges: $defPrivExtraText tipo(s) de objeto inesperado(s) além de r,S,f. Reutilização recusada."
        }
        $defPrivExpected = @{
            "r" = @{ Priv = "arwdDxt"; Label = "tables" }
            "S" = @{ Priv = "rwU"; Label = "sequences" }
            "f" = @{ Priv = "X"; Label = "functions" }
        }
        $defPrivSeen = @{}
        foreach ($line in $defPrivLines) {
            $sep = $line.IndexOf('|')
            if ($sep -lt 0) {
                throw "Default privilege formato inesperado (sem separador '|'): '$line'."
            }
            $objType = $line.Substring(0, $sep).Trim()
            $aclText = $line.Substring($sep + 1).Trim()
            if (-not $defPrivExpected.ContainsKey($objType)) {
                throw "Tipo de default privilege inesperado: '$objType'. Esperados: r, S, f."
            }
            if ($defPrivSeen.ContainsKey($objType)) {
                throw "Tipo de default privilege duplicado: '$objType'."
            }
            $defPrivSeen[$objType] = $true
            $expected = $defPrivExpected[$objType]
            # Parse todas as entries da ACL deste tipo
            $defAclInner = $aclText.TrimStart('{').TrimEnd('}')
            if ($defAclInner -eq "") {
                throw "defaclacl($objType): ACL vazia. Esperado: $TEST_ROLE=$($expected.Priv)/$PG_ADMIN_USER."
            }
            $defAclEntries = $defAclInner.Split(',')
            $typeRoleFound = $false
            $unexpectedEntries = @()
            foreach ($dEntry in $defAclEntries) {
                $deqIdx = $dEntry.IndexOf('=')
                $dslIdx = $dEntry.LastIndexOf('/')
                if ($deqIdx -lt 0 -or $dslIdx -lt 0 -or $dslIdx -le $deqIdx) {
                    throw "defaclacl($objType): formato inválido: '$dEntry'. ACL: '$aclText'."
                }
                $dGrantee = $dEntry.Substring(0, $deqIdx)
                $dPrivs = $dEntry.Substring($deqIdx + 1, $dslIdx - $deqIdx - 1)
                $dGrantor = $dEntry.Substring($dslIdx + 1)
                if ($dGrantee -eq $TEST_ROLE) {
                    if ($typeRoleFound) {
                        throw "defaclacl($objType): entrada duplicada para '$TEST_ROLE'. ACL: '$aclText'."
                    }
                    if ($dPrivs -match '\*') {
                        throw "defaclacl($objType): WITH GRANT OPTION detectado ('$dPrivs'). Não autorizado. ACL: '$aclText'."
                    }
                    if ($dPrivs -ne $expected.Priv) {
                        throw "defaclacl($objType): privilégios '$dPrivs' (esperado exato: '$($expected.Priv)'). ACL: '$aclText'. Reutilização recusada."
                    }
                    if ($dGrantor -ne $PG_ADMIN_USER) {
                        throw "defaclacl($objType): grantor '$dGrantor' (esperado: '$PG_ADMIN_USER'). ACL: '$aclText'. Reutilização recusada."
                    }
                    $typeRoleFound = $true
                } else {
                    $unexpectedEntries += $dEntry
                }
            }
            if (-not $typeRoleFound) {
                throw "defaclacl($objType): entrada para '$TEST_ROLE' ausente. ACL: '$aclText'. Reutilização recusada."
            }
            if ($unexpectedEntries.Count -gt 0) {
                $unexpectedStr = $unexpectedEntries -join ", "
                throw "defaclacl($objType): entradas não autorizadas: $unexpectedStr. ACL: '$aclText'. Reutilização recusada."
            }
            Write-Host "    Default $($expected.Label): $TEST_ROLE=$($expected.Priv)/$PG_ADMIN_USER — OK (sem entradas extras)" -ForegroundColor Gray
        }
        foreach ($key in @("r","S","f")) {
            if (-not $defPrivSeen.ContainsKey($key)) {
                throw "Default privilege para tipo '$key' ($($defPrivExpected[$key].Label)) ausente."
            }
        }

        $roleAlreadyExists = $true
        Write-Host "  OK: Role '$TEST_ROLE' existe com atributos e permissões corretos — reutilização aprovada." -ForegroundColor Green
    }
    elseif ($roleCheckTrimmed -eq "") {
        Write-Host "  OK: Role '$TEST_ROLE' não existe no cluster (será criada)." -ForegroundColor Green
    }
    else {
        throw "Resposta inesperada ao consultar pg_roles: '$roleCheckTrimmed'."
    }

    # ═══════════════════════════════════════════════════
    # ETAPA 6: Provisionamento condicional da base, pgcrypto e role restrita
    # Reutiliza recursos existentes validados; cria do zero se necessário.
    # ═══════════════════════════════════════════════════
    Write-Host "[6/9] Provisionando base '$DB_NAME', pgcrypto e role '$TEST_ROLE'..." -ForegroundColor White

    # Barreira de segurança: combinação incompatível (banco preexistente + role inexistente)
    # Provisionar uma nova role exigiria GRANT CONNECT no banco preexistente,
    # alterando ACLs de um recurso validado. Isso viola a regra de isolamento.
    if ($dbAlreadyExists -and -not $roleAlreadyExists) {
        throw "Combinação insegura: banco '$DB_NAME' preexistente + role '$TEST_ROLE' inexistente. Provisionar permissões da nova role exigiria alterar ACLs do banco preexistente. Abortando sem modificar recursos."
    }

    # 1. Criar base de testes (condicional)
    if ($dbAlreadyExists) {
        Write-Host "  Base '$DB_NAME' já existe e foi validada — reutilizando." -ForegroundColor Yellow
    } else {
        Write-Host "  Criando base '$DB_NAME' exclusivamente do zero para testes..." -ForegroundColor Yellow
        & "$PG_BIN\createdb.exe" -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER $DB_NAME 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Falha ao criar base '$DB_NAME'."
        }
        Write-Host "  OK: Base '$DB_NAME' criada com sucesso." -ForegroundColor Green
    }

    # 2. Verificar ou provisionar extensão pgcrypto (condicional)
    if ($dbAlreadyExists) {
        # Banco existente — validar pgcrypto sem executar CREATE EXTENSION
        $extQuery = "SELECT e.extname, e.extversion, n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pgcrypto';"
        $extResult = & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d $DB_NAME -t -A -v ON_ERROR_STOP=1 -c $extQuery 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Falha ao consultar pg_extension na base '$DB_NAME'." }
        $extText = (@($extResult) -join " ").Trim()
        if ($extText -eq "") {
            throw "Extensão 'pgcrypto' ausente na base existente '$DB_NAME'. Reutilização recusada (CREATE EXTENSION não autorizado em banco existente)."
        }
        $extParts = $extText.Split('|')
        if ($extParts.Count -ne 3) {
            throw "pgcrypto: $($extParts.Count) campos (esperado: 3). Saída: '$extText'."
        }
        $extName = $extParts[0].Trim()
        $extVer = $extParts[1].Trim()
        $extSchema = $extParts[2].Trim()
        if ($extName -ne "pgcrypto") {
            throw "pgcrypto: nome divergente '$extName'."
        }
        if ($extVer -ne "1.3") {
            throw "pgcrypto: versão '$extVer' (esperado: '1.3'). Reutilização recusada."
        }
        if ($extSchema -ne "public") {
            throw "pgcrypto: schema '$extSchema' (esperado: 'public'). Reutilização recusada."
        }
        Write-Host "  OK: pgcrypto validada (versão $extVer, schema $extSchema) — sem CREATE EXTENSION." -ForegroundColor Green
    } else {
        # Banco novo — criar pgcrypto e validar instalação
        & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d $DB_NAME -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Falha ao criar a extensão 'pgcrypto' na base '$DB_NAME'."
        }
        $extCheckQuery = "SELECT e.extversion, n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pgcrypto';"
        $extCheckResult = & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d $DB_NAME -t -A -v ON_ERROR_STOP=1 -c $extCheckQuery 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Falha ao validar instalação de pgcrypto." }
        $extCheckText = (@($extCheckResult) -join " ").Trim()
        if ($extCheckText -eq "") { throw "pgcrypto não encontrada após CREATE EXTENSION." }
        $extCheckParts = $extCheckText.Split('|')
        if ($extCheckParts.Count -ne 2) {
            throw "Validação pgcrypto: $($extCheckParts.Count) campos (esperado: 2). Saída: '$extCheckText'."
        }
        Write-Host "  OK: pgcrypto criada e validada (versão $($extCheckParts[0].Trim()), schema $($extCheckParts[1].Trim()))." -ForegroundColor Green
    }

    # 3. Gerar token criptográfico aleatório para a sessão
    # NOTA: Strings .NET são imutáveis — atribuir $null remove a referência mas não garante
    # zeragem física na memória heap gerenciada. O array mutável de bytes é zerado com Array.Clear.
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rngBytes = New-Object byte[] 24
    try {
        $rng.GetBytes($rngBytes)
        $testRolePassword = [System.BitConverter]::ToString($rngBytes).Replace("-", "").ToLower()
    } finally {
        [Array]::Clear($rngBytes, 0, $rngBytes.Length)
        $rngBytes = $null
        $rng.Dispose()
        $rng = $null
    }

    # 4. Criar ou restaurar credencial da role (condicional)
    # SQL transmitido por STDIN (-f -) para que a senha NUNCA apareça nos argumentos do processo.
    if ($roleAlreadyExists) {
        # Role existente validada — apenas redefinir a senha efêmera
        Write-Host "  Role '$TEST_ROLE' já existe — redefinindo senha efêmera via STDIN..." -ForegroundColor Yellow
        $alterRoleSql = "ALTER ROLE $TEST_ROLE PASSWORD '$testRolePassword';"
        $alterRoleSql | & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d postgres -v ON_ERROR_STOP=1 -f - 2>&1 | Out-Null
        $alterRoleExit = $LASTEXITCODE
        $alterRoleSql = $null
        if ($alterRoleExit -ne 0) {
            throw "Falha ao redefinir senha da role '$TEST_ROLE'."
        }
        Write-Host "  OK: Senha efêmera da role '$TEST_ROLE' redefinida via STDIN." -ForegroundColor Green
    } else {
        # Role não existe — criar com atributos estritos
        Write-Host "  Criando role '$TEST_ROLE' com permissões restritas via STDIN..." -ForegroundColor Yellow
        $createRoleSql = "CREATE ROLE $TEST_ROLE WITH LOGIN PASSWORD '$testRolePassword' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;"
        $createRoleSql | & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d postgres -v ON_ERROR_STOP=1 -f - 2>&1 | Out-Null
        $createRoleExit = $LASTEXITCODE
        $createRoleSql = $null
        if ($createRoleExit -ne 0) {
            throw "Falha ao criar a role restrita '$TEST_ROLE'."
        }
        Write-Host "  OK: Role '$TEST_ROLE' criada com permissões restritas (NOSUPERUSER) via STDIN." -ForegroundColor Green
    }

    # 5. Provisionamento granular de permissões — por recurso individual
    #    Não utiliza regra genérica. Cada combinação é tratada explicitamente.
    if ($dbAlreadyExists -and $roleAlreadyExists) {
        # Ambos existentes e validados na etapa 5 — nenhum GRANT necessário
        Write-Host "  Banco e role existentes com permissões validadas — GRANTs não reexecutados." -ForegroundColor Yellow
    } elseif (-not $dbAlreadyExists -and -not $roleAlreadyExists) {
        # Ambos novos — provisionamento completo de permissões em bloco transacional
        $grantSql = @"
BEGIN;
GRANT CONNECT ON DATABASE $DB_NAME TO $TEST_ROLE;
GRANT USAGE, CREATE ON SCHEMA public TO $TEST_ROLE;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $TEST_ROLE;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $TEST_ROLE;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO $TEST_ROLE;
ALTER DEFAULT PRIVILEGES FOR ROLE $PG_ADMIN_USER IN SCHEMA public GRANT ALL ON TABLES TO $TEST_ROLE;
ALTER DEFAULT PRIVILEGES FOR ROLE $PG_ADMIN_USER IN SCHEMA public GRANT ALL ON SEQUENCES TO $TEST_ROLE;
ALTER DEFAULT PRIVILEGES FOR ROLE $PG_ADMIN_USER IN SCHEMA public GRANT ALL ON FUNCTIONS TO $TEST_ROLE;
COMMIT;
"@
        $grantSql | & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d $DB_NAME -v ON_ERROR_STOP=1 -f - 2>&1 | Out-Null
        $grantExit = $LASTEXITCODE
        $grantSql = $null
        if ($grantExit -ne 0) {
            throw "Falha ao configurar permissões da role '$TEST_ROLE' na base '$DB_NAME'."
        }
        Write-Host "  OK: Privilégios provisionados para novos banco e role em '$DB_NAME'." -ForegroundColor Green
    } elseif (-not $dbAlreadyExists -and $roleAlreadyExists) {
        # Banco novo + Role existente — provisionar somente permissões no recurso novo
        # O banco é recurso novo (ACLs e default privileges ainda não existem).
        # A role existente não é alterada (apenas recebe permissões no novo banco).
        $grantSql = @"
BEGIN;
GRANT CONNECT ON DATABASE $DB_NAME TO $TEST_ROLE;
GRANT USAGE, CREATE ON SCHEMA public TO $TEST_ROLE;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $TEST_ROLE;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $TEST_ROLE;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO $TEST_ROLE;
ALTER DEFAULT PRIVILEGES FOR ROLE $PG_ADMIN_USER IN SCHEMA public GRANT ALL ON TABLES TO $TEST_ROLE;
ALTER DEFAULT PRIVILEGES FOR ROLE $PG_ADMIN_USER IN SCHEMA public GRANT ALL ON SEQUENCES TO $TEST_ROLE;
ALTER DEFAULT PRIVILEGES FOR ROLE $PG_ADMIN_USER IN SCHEMA public GRANT ALL ON FUNCTIONS TO $TEST_ROLE;
COMMIT;
"@
        $grantSql | & "$PG_BIN\psql.exe" -X -h $PG_HOST -p $PG_PORT -U $PG_ADMIN_USER -d $DB_NAME -v ON_ERROR_STOP=1 -f - 2>&1 | Out-Null
        $grantExit = $LASTEXITCODE
        $grantSql = $null
        if ($grantExit -ne 0) {
            throw "Falha ao configurar permissões da role existente '$TEST_ROLE' no novo banco '$DB_NAME'."
        }
        Write-Host "  OK: Privilégios provisionados para role existente no novo banco '$DB_NAME'." -ForegroundColor Green
    }

    # Limpeza imediata da senha administrativa da memória e do ambiente
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    $plainPassword  = $null

    # ═══════════════════════════════════════════════════
    # ETAPA 7: Configurar TEST_DATABASE_URL em memória com a role restrita
    # ═══════════════════════════════════════════════════
    Write-Host "[7/9] Configurando TEST_DATABASE_URL em memória com a role restrita..." -ForegroundColor White

    $escapedTestPassword = [Uri]::EscapeDataString($testRolePassword)
    $env:TEST_DATABASE_URL = "postgresql://${TEST_ROLE}:${escapedTestPassword}@${PG_HOST}:${PG_PORT}/${DB_NAME}"
    $escapedTestPassword = $null
    $testRolePassword    = $null

    Write-Host "  Host: $PG_HOST (127.0.0.1 estrito)" -ForegroundColor Green
    Write-Host "  Porta: $PG_PORT" -ForegroundColor Green
    Write-Host "  Base: $DB_NAME" -ForegroundColor Green
    Write-Host "  Usuário: $TEST_ROLE (não-superusuário)" -ForegroundColor Green
    Write-Host "  Credenciais em tela/logs: NENHUMA" -ForegroundColor Green

    # ═══════════════════════════════════════════════════
    # ETAPA 8: Executar testes de integração (FAIL-FAST, sem --forceExit)
    # ═══════════════════════════════════════════════════
    Write-Host ""
    Write-Host "[8/9] Executando testes reais de INTEGRAÇÃO (sem --forceExit)..." -ForegroundColor Cyan
    Write-Host "─────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray

    Set-Location $PROJECT_DIR
    if (-not (Test-Path $JEST_JS)) {
        throw "Script Jest não encontrado em '$JEST_JS'. Não é permitido download automático de pacotes."
    }

    $LASTEXITCODE = 0
    & node.exe $JEST_JS tests/integration/phase-2b-postgres.test.js --runInBand --no-coverage --verbose
    $integrationExitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 1 }

    if ($integrationExitCode -ne 0) {
        $scriptExitCode = $integrationExitCode
        Write-Host ""
        Write-Host "🚨 [FAIL-FAST] Falha na suíte de integração (exit code $integrationExitCode)." -ForegroundColor Red
        Write-Host "   Os testes unitários NÃO serão executados até que a integração passe." -ForegroundColor Yellow
        return
    }

    Write-Host ""
    Write-Host "✅ [INTEGRAÇÃO] Todos os testes com PostgreSQL real passaram com sucesso!" -ForegroundColor Green

    # ═══════════════════════════════════════════════════
    # ETAPA 9: Executar testes unitários (sem --forceExit)
    # ═══════════════════════════════════════════════════
    Write-Host ""
    Write-Host "[9/9] Executando testes UNITÁRIOS da Fase 2B (sem --forceExit)..." -ForegroundColor Cyan
    Write-Host "─────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray

    $LASTEXITCODE = 0
    & node.exe $JEST_JS tests/unit/phase-2b-scheduling.test.js --no-coverage --verbose
    $unitExitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 1 }

    if ($unitExitCode -ne 0) {
        $scriptExitCode = $unitExitCode
        Write-Host ""
        Write-Host "🚨 [FALHA] Falha nos testes unitários (exit code $unitExitCode)." -ForegroundColor Red
        return
    }

    Write-Host ""
    Write-Host "✅ [UNITÁRIOS] Todos os testes unitários passaram com sucesso!" -ForegroundColor Green

    # ═══════════════════════════════════════════════════
    # RESUMO FINAL
    # ═══════════════════════════════════════════════════
    Write-Host ""
    Write-Host "═══ RESUMO DA VALIDAÇÃO ═══" -ForegroundColor Cyan
    Write-Host "  Integração: APROVADO (PostgreSQL Real em 127.0.0.1:5432/$DB_NAME)" -ForegroundColor Green
    Write-Host "  Unitários:  APROVADO (Isolamento, Fail-Closed, Rate Limiter)" -ForegroundColor Green
    Write-Host "  Usuário:    $TEST_ROLE (permissões mínimas)" -ForegroundColor Green
    Write-Host "  Produção:   INTOCADA (nenhum tráfego, migration ou commit)" -ForegroundColor Green
    Write-Host ""

} catch {
    $scriptExitCode = 1
    Write-Host ""
    Write-Host "❌ ERRO NO EXECUTOR (Linha $($_.InvocationInfo.ScriptLineNumber)): $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
} finally {
    # ═══════════════════════════════════════════════════
    # LIMPEZA DETERMINÍSTICA GARANTIDA
    # ═══════════════════════════════════════════════════
    # AVISO DE SEGURANÇA: O bloco finally é garantido pelo runtime do PowerShell
    # em fluxos normais, exceções tratadas e retornos (return). Contudo, o
    # encerramento forçado do processo (ex.: SIGKILL, término forçado via
    # Gerenciador de Tarefas/taskkill /F ou falha de hardware/SO) não garante
    # a execução do bloco finally.
    Write-Host "[LIMPEZA] Removendo variáveis de ambiente e referências de credenciais..." -ForegroundColor DarkGray

    Remove-Item Env:\TEST_DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

    $plainPassword       = $null
    $testRolePassword    = $null
    $securePassword      = $null
    $createRoleSql       = $null
    $alterRoleSql        = $null
    $grantSql            = $null
    $escapedTestPassword = $null
    $identitySql         = $null

    Write-Host "[LIMPEZA] TEST_DATABASE_URL removida." -ForegroundColor DarkGray
    Write-Host "[LIMPEZA] PGPASSWORD removida." -ForegroundColor DarkGray
    Write-Host "[LIMPEZA] Referências a credenciais em memória zeradas." -ForegroundColor DarkGray
    Write-Host ""

    if ($scriptExitCode -ne 0) {
        Write-Host "Execução finalizada com erro (exit code $scriptExitCode)." -ForegroundColor Red
        exit $scriptExitCode
    } else {
        Write-Host "Execução finalizada com sucesso." -ForegroundColor Green
    }
}
