const { config } = require("./config.js");

/**
 * Cliente da API do Cobalt (https://github.com/imputnet/cobalt).
 *
 * Endpoint: POST / na raiz da instancia.
 * Headers obrigatorios: Accept + Content-Type. Authorization e opcional (Api-Key).
 *
 * Status possiveis na resposta:
 *   - tunnel           -> { url, filename }  (arquivo via proxy do cobalt)
 *   - redirect         -> { url, filename }  (link direto da fonte)
 *   - picker           -> { picker: [{ type, url, thumb? }], audio? }  (varias midias)
 *   - local-processing -> { type, tunnel: [...], output, audio? }  (precisa juntar streams)
 *   - error            -> { error: { code, context? } }
 */

const USER_AGENT = "botinsanoskol/1.0 (+https://github.com/imputnet/cobalt)";

function headers() {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT,
    ...(config.cobalt.apiKey ? { Authorization: `Api-Key ${config.cobalt.apiKey}` } : {}),
  };
}

/**
 * Faz uma requisicao de download ao cobalt.
 * @param {string} url     link da midia
 * @param {object} options opcoes do cobalt (videoQuality, audioFormat, downloadMode, ...)
 * @returns {Promise<object>} a resposta JSON (ou um objeto status:'error' em falhas locais)
 */
async function cobaltRequest(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(config.cobalt.baseUrl, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ url, ...options }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    if (!data || typeof data.status !== "string") {
      return { status: "error", error: { code: "error.local.invalid_response" } };
    }
    return data;
  } catch (err) {
    const code = err.name === "AbortError" ? "error.local.timeout" : "error.local.unreachable";
    return { status: "error", error: { code, context: { message: String(err?.message || err) } } };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Checa, na inicializacao, se a instancia do cobalt esta de pe (GET /).
 */
async function cobaltHealth() {
  try {
    const res = await fetch(config.cobalt.baseUrl, { headers: { Accept: "application/json" } });
    if (!res.ok) return { ok: false, status: res.status };
    const data = await res.json().catch(() => ({}));
    return {
      ok: true,
      version: data?.cobalt?.version ?? "?",
      services: Array.isArray(data?.cobalt?.services) ? data.cobalt.services.length : "?",
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

/**
 * Baixa um arquivo respeitando um limite de tamanho. Le o stream em pedacos e
 * ABORTA assim que passa de maxBytes (nao baixa o video de 84MB inteiro a toa,
 * nem estoura a memoria). Os tunnels do cobalt nao mandam content-length, por
 * isso a checagem e feita durante a leitura.
 * @returns {Promise<{ok:true, buffer:Buffer, size:number} | {ok:false, reason:'too_big'|'timeout'|'error'|string, size?:number}>}
 */
async function downloadCapped(url, maxBytes) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };

    const declared = Number(res.headers.get("content-length") || 0);
    if (declared && declared > maxBytes) return { ok: false, reason: "too_big", size: declared };

    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        controller.abort();
        return { ok: false, reason: "too_big" };
      }
      chunks.push(value);
    }
    if (total === 0) return { ok: false, reason: "empty" };
    return { ok: true, buffer: Buffer.concat(chunks), size: total };
  } catch (err) {
    return { ok: false, reason: err.name === "AbortError" ? "timeout" : "error" };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Traduz um codigo de erro do cobalt para uma mensagem amigavel em PT-BR.
 * Os codigos sao "namespaced" por ponto, entao casamos por trecho/prefixo.
 */
function explainCobaltError(code = "") {
  const c = String(code);
  if (c.includes("link.invalid") || c.includes("link.unsupported")) return "Esse link e invalido ou nao e suportado.";
  if (c.includes("service.unsupported") || c.includes("service.disabled")) return "Esse servico nao e suportado por esta instancia do cobalt.";
  if (c.includes("fetch.empty") || c.includes("fetch.fail") || c.includes("content.video.unavailable") || c.includes("content.post.unavailable")) {
    return "Nao consegui acessar essa midia (pode ser privada, removida ou indisponivel na regiao).";
  }
  if (c.includes("content.too_long") || c.includes("content.video.large")) return "A midia e grande/longa demais para o cobalt processar.";
  if (c.includes("auth.key") || c.includes("auth.turnstile") || c.includes("auth.jwt")) {
    return "A instancia do cobalt exige autenticacao. Confira o COBALT_API_KEY no .env.";
  }
  if (c.includes("local.timeout")) return "O cobalt demorou demais para responder (timeout).";
  if (c.includes("local.unreachable")) return "Nao consegui conectar na instancia do cobalt. Ela esta rodando? Confira o COBALT_BASE_URL.";
  if (c.includes("local.invalid_response")) return "A instancia do cobalt respondeu algo inesperado. Verifique a versao/URL.";
  if (c.includes("rate") || c.includes("limit")) return "Limite de requisicoes atingido. Tente de novo em instantes.";
  return `Erro do cobalt: \`${c || "desconhecido"}\`.`;
}

module.exports = { cobaltRequest, cobaltHealth, downloadCapped, explainCobaltError };
