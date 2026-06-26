const { randomUUID } = require("node:crypto");
const { config } = require("./config.js");

/**
 * Cache em memoria token -> dados do pedido.
 *
 * Por que: o custom_id de um botao tem no maximo 100 caracteres e muitos links
 * de midia passam disso. Entao guardamos a URL (e o picker, se houver) aqui e
 * colocamos so um token curto no botao. Ao clicar, resolvemos no cobalt na hora.
 *
 * Observacao: por ser em memoria, os tokens somem se o bot reiniciar.
 */

const store = new Map();

function putRequest(payload) {
  const token = randomUUID().replace(/-/g, "").slice(0, 16);
  store.set(token, { ...payload, expiresAt: Date.now() + config.cacheTtlMs });
  return token;
}

function getRequest(token) {
  const entry = store.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(token);
    return null;
  }
  return entry;
}

/** Remove tokens expirados de tempos em tempos para nao vazar memoria. */
function startCacheJanitor() {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of store) {
      if (now > value.expiresAt) store.delete(key);
    }
  }, 5 * 60 * 1000);
  timer.unref?.();
}

module.exports = { putRequest, getRequest, startCacheJanitor };
