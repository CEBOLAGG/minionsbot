/**
 * Store temporário (em memória) das odds escolhidas no clique do botão de aposta.
 *
 * Por quê: a odd NÃO pode vir do customId do modal — o cliente controla esse valor
 * e poderia forjar uma odd gigante (payout infinito). Aqui o servidor grava a odd
 * legítima (calculada do jogo) no momento do clique, e o handler do modal lê DAQUI,
 * ignorando o customId. Chave: `${userId}:${matchId}:${betType}`.
 */

const store = new Map(); // key -> { odds, expires }
const TTL = 10 * 60 * 1000; // 10 min (tempo de sobra pra preencher o modal)

function setBetOdds(key, odds) {
	store.set(key, { odds, expires: Date.now() + TTL });
}

function getBetOdds(key) {
	const entry = store.get(key);
	if (!entry) return null;
	if (entry.expires < Date.now()) {
		store.delete(key);
		return null;
	}
	return entry.odds;
}

// Limpeza periódica das entradas expiradas (não segura o processo vivo).
const _t = setInterval(() => {
	const now = Date.now();
	for (const [k, v] of store) if (v.expires < now) store.delete(k);
}, 5 * 60 * 1000);
if (_t.unref) _t.unref();

module.exports = { setBetOdds, getBetOdds };
