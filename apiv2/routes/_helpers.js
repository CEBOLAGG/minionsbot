"use strict";

const { buildPlayerSnapshot } = require("../util/snapshot");

/** Pega o player da guild; responde 404 se não houver e retorna null. */
function getPlayerOr404(ctx, req, res) {
	const guildId = req.params.id;
	const guild = ctx.client.guilds.cache.get(guildId);
	if (!guild) {
		res.status(404).json({ error: "bot não está nesse servidor" });
		return null;
	}
	const player = ctx.client.manager?.players?.get(guildId);
	if (!player) {
		res.status(409).json({ error: "nada tocando nesse servidor" });
		return null;
	}
	return player;
}

/**
 * Executa uma mutação no player, empurra o snapshot novo via WebSocket na hora
 * e responde com ele. Centraliza o "faça algo + reflita ao vivo".
 */
function mutateAndReply(ctx, guildId, mutateFn, res) {
	try {
		mutateFn();
	} catch (e) {
		return res.status(500).json({ error: "falha na ação: " + (e?.message || e) });
	}
	// pequeno atraso deixa o lavalink aplicar antes de fotografar
	setTimeout(() => {
		try {
			ctx.hub?.pushPlayer(guildId);
		} catch {}
	}, 120);
	return res.json({ ok: true, player: buildPlayerSnapshot(ctx.client, guildId) });
}

module.exports = { getPlayerOr404, mutateAndReply };
