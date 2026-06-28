"use strict";

/**
 * Autenticação do apiv2.
 *
 * Dois mecanismos:
 *  1) Bearer token (server-to-server): as route handlers da Vercel chamam o bot
 *     com `Authorization: Bearer <BOT_API_TOKEN>`. A Vercel é quem valida a
 *     sessão Discord do usuário e a permissão "Gerenciar Servidor" por guild
 *     ANTES de repassar — então aqui só conferimos o token compartilhado.
 *  2) Ticket WS (browser-to-bot): JWT HS256 curto assinado pela Vercel com o
 *     REALTIME_SECRET, carregando { userId, guildIds, exp }. O bot valida a
 *     assinatura e só entrega eventos das guilds listadas.
 */

const crypto = require("crypto");
const { verify } = require("./jwt");

function timingSafeEqualStr(a, b) {
	const ab = Buffer.from(String(a));
	const bb = Buffer.from(String(b));
	if (ab.length !== bb.length) return false;
	return crypto.timingSafeEqual(ab, bb);
}

/**
 * Middleware Express: exige Bearer token válido.
 * @param {object} cfg apiv2 config
 */
function bearerAuth(cfg) {
	return (req, res, next) => {
		if (!cfg || !cfg.token) {
			return res.status(503).json({ error: "apiv2 token not configured" });
		}
		const header = req.headers.authorization || "";
		const [scheme, token] = header.split(" ");
		if (scheme !== "Bearer" || !token || !timingSafeEqualStr(token, cfg.token)) {
			return res.status(401).json({ error: "unauthorized" });
		}
		next();
	};
}

/**
 * Verifica um ticket de WebSocket. Retorna o payload ou lança.
 * @param {string} ticket
 * @param {object} cfg apiv2 config
 */
function verifyTicket(ticket, cfg) {
	if (!cfg || !cfg.realtimeSecret) throw new Error("realtime secret not configured");
	const payload = verify(ticket, cfg.realtimeSecret);
	if (!Array.isArray(payload.guildIds)) payload.guildIds = [];
	return payload;
}

module.exports = { bearerAuth, verifyTicket };
