"use strict";

const { Router } = require("express");
const { buildGuildSnapshot, buildPlayerSnapshot } = require("../util/snapshot");
const { getOrCreateGuild } = require("../../util/mongodb");
const guildDb = require("../../util/guildDb");

/** @param {{client:any,cfg:any,hub:any}} ctx */
module.exports = (ctx) => {
	const r = Router({ caseSensitive: true });
	const { client } = ctx;

	// GET /v2/guilds?ids=a,b,c — enriquece a lista de guilds do usuário com estado do bot.
	// A Vercel manda os ids das guilds que o usuário pode gerenciar; devolvemos só as
	// que o bot está, já com estado ao vivo (tocando? quantos ouvintes? tamanho da fila?).
	r.get("/", (req, res) => {
		const idsParam = (req.query.ids || "").toString().trim();
		const filter = idsParam ? new Set(idsParam.split(",").map((s) => s.trim())) : null;

		const out = [];
		client.guilds.cache.forEach((guild) => {
			if (filter && !filter.has(guild.id)) return;
			const player = client.manager?.players?.get(guild.id);
			const current = player ? player.queue?.current || player.current : null;
			out.push({
				id: guild.id,
				name: guild.name,
				iconURL: guild.iconURL({ size: 128 }) || null,
				memberCount: guild.memberCount,
				hasBot: true,
				playing: !!current && !player.paused,
				queueLength: player ? (typeof player.queue?.length === "number" ? player.queue.length : 0) : 0,
				nowPlayingTitle: current ? current.info?.title || null : null,
			});
		});
		res.json(out);
	});

	// GET /v2/guilds/:id — snapshot completo (settings + canais + roles + player)
	r.get("/:id", async (req, res) => {
		const guild = client.guilds.cache.get(req.params.id);
		if (!guild) return res.status(404).json({ error: "bot não está nesse servidor" });
		let doc = {};
		try {
			doc = (await getOrCreateGuild(req.params.id)) || {};
		} catch {}
		const snap = buildGuildSnapshot(client, req.params.id, doc);
		if (!snap) return res.status(404).json({ error: "guild não encontrada" });
		res.json(snap);
	});

	// PATCH /v2/guilds/:id/settings — atualiza configurações de música/servidor
	r.patch("/:id/settings", async (req, res) => {
		const guildId = req.params.id;
		if (!client.guilds.cache.has(guildId)) {
			return res.status(404).json({ error: "bot não está nesse servidor" });
		}
		const b = req.body || {};
		try {
			if (typeof b.djOnly === "boolean") await guildDb.setDjOnly(guildId, b.djOnly);
			// setVolume (guildDb) corta em 0–100; mantemos a faixa coerente aqui.
			if (typeof b.defaultVolume === "number" && b.defaultVolume >= 1 && b.defaultVolume <= 100) {
				await guildDb.setVolume(guildId, b.defaultVolume);
			}
			if (typeof b.twentyFourSeven === "boolean") await guildDb.set247(guildId, b.twentyFourSeven);
			if (typeof b.autoQueue === "boolean") await guildDb.setAutoQueue(guildId, b.autoQueue);
			if (typeof b.autoPause === "boolean") await guildDb.setAutoPause(guildId, b.autoPause);
			if (typeof b.autoLeave === "boolean") await guildDb.setAutoLeave(guildId, b.autoLeave);

			// toggles por canal (vnw / ignorant / toxic)
			if (b.vnwMode && typeof b.vnwMode.channelId === "string") {
				await guildDb.setVnwMode(guildId, b.vnwMode.channelId, !!b.vnwMode.enabled);
			}
			if (b.ignorantMode && typeof b.ignorantMode.channelId === "string") {
				await guildDb.setIgnorantMode(guildId, b.ignorantMode.channelId, !!b.ignorantMode.enabled);
			}
			if (b.toxicMode && typeof b.toxicMode.channelId === "string") {
				await guildDb.setToxicMode(guildId, b.toxicMode.channelId, !!b.toxicMode.enabled);
			}
		} catch (e) {
			return res.status(500).json({ error: "falha ao salvar: " + (e?.message || e) });
		}

		const doc = (await getOrCreateGuild(guildId).catch(() => ({}))) || {};
		const snap = buildGuildSnapshot(client, guildId, doc);
		ctx.hub?.pushPlayer(guildId);
		res.json({ ok: true, settings: snap?.settings, player: buildPlayerSnapshot(client, guildId) });
	});

	return r;
};
