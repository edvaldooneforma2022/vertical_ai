// 🛡️ URL GUARD — UNIVERSAL (NÃO ALTERA, SÓ PROTEGE)

function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;

    try {
        const u = new URL(url.trim());
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

function isCorruptedUrl(url) {
    if (!url) return true;

    return (
        url.includes('..') ||         // ev..com, pay..com
        url.includes('undefined') ||
        url.includes('null') ||
        url.length < 10
    );
}

// 🧠 função principal (SAFE)
function guardUrl(url) {
    if (!url) return null;

    const clean = url.trim();

    if (isCorruptedUrl(clean)) {
        console.warn('[URL-GUARD] ❌ URL corrompida:', clean);
        return null;
    }

    if (!isValidUrl(clean)) {
        console.warn('[URL-GUARD] ❌ URL inválida:', clean);
        return null;
    }

    return clean; // 🔥 NÃO MODIFICA
}

// 🧠 fallback inteligente (SEM INVENTAR)
function resolveBestLink(data = {}) {
    const candidates = [
        data.checkoutLink,
        data.contatos?.whatsappLinks?.[0],
        data.contatos?.whatsapp?.[0],
        data.whatsappLink,
        ...(data.linksExtraidos || []),
    ];

    for (const link of candidates) {
        const valid = guardUrl(link);
        if (valid) return valid;
    }

    return null;
}

module.exports = {
    guardUrl,
    resolveBestLink
};
