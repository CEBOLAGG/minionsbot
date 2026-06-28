"use strict";

const { Router } = require("express");
const { getPlayerOr404, mutateAndReply } = require("./_helpers");

// presets de filtro espelhando commands/slash/filters.js (player.filters.* do lavalink-client)
const FILTER_PRESETS = {
	clear: (f) => f.clearFilters(),
	nightcore: (f) => f.setTimescale({ speed: 1.25, pitch: 1.25, rate: 1.0 }),
	vaporwave: (f) => f.setTimescale({ speed: 0.85, pitch: 0.85, rate: 1.0 }),
	"8d": (f) => f.set8D(true, { rotationHz: 0.2 }),
	karaoke: (f) => f.setKaraoke({ level: 1.0, monoLevel: 1.0, filterBand: 220, filterWidth: 100 }),
	vibrato: (f) => f.setVibrato({ frequency: 4, depth: 0.75 }),
	tremolo: (f) => f.setTremolo({ frequency: 4, depth: 0.75 }),
	lowpass: (f) => f.setLowPass({ smoothing: 20.0 }),
	bassboost_low: (f) =>
		f.setEqualizer([
			{ band: 0, gain: 0.2 }, { band: 1, gain: 0.15 }, { band: 2, gain: 0.1 },
		]),
	bassboost_medium: (f) =>
		f.setEqualizer([
			{ band: 0, gain: 0.4 }, { band: 1, gain: 0.3 }, { band: 2, gain: 0.2 },
		]),
	bassboost_high: (f) =>
		f.setEqualizer([
			{ band: 0, gain: 0.6 }, { band: 1, gain: 0.45 }, { band: 2, gain: 0.3 },
		]),
};

/** @param {{client:any,cfg:any,hub:any}} ctx */
module.exports = (ctx) => {
	const r = Router({ caseSensitive: true });

	// POST /v2/guilds/:id/player/:action — transporte (pause/resume/skip/previous/stop/shuffle/seek/volume/loop)
	r.post("/:id/player/:action", (req, res) => {
		const player = getPlayerOr404(ctx, req, res);
		if (!player) return;
		const { action } = req.params;
		const b = req.body || {};
		const gid = req.params.id;

		switch (action) {
			case "pause":
				return mutateAndReply(ctx, gid, () => player.pause(true), res);
			case "resume":
				return mutateAndReply(ctx, gid, () => player.pause(false), res);
			case "skip":
				// player.skip() AVANÇA p/ a próxima (player.stop() limparia a fila e pararia).
				return mutateAndReply(ctx, gid, () => { player.skip(0, false).catch(() => {}); }, res);
			case "stop":
				return mutateAndReply(ctx, gid, () => {
					try { player.queue.clear(); } catch {}
					player.stop();
				}, res);
			case "shuffle":
				return mutateAndReply(ctx, gid, () => player.queue.shuffle(), res);
			case "previous": {
				const prevRaw = player.queue?.previous;
				const prev = Array.isArray(prevRaw) ? prevRaw[0] : prevRaw;
				if (!prev) return res.status(409).json({ error: "não há música anterior" });
				return mutateAndReply(ctx, gid, () => {
					const cur = player.queue?.current;
					if (cur) player.queue.unshift(cur);
					player.queue.unshift(prev);
					player.skip(0, false).catch(() => {});
				}, res);
			}
			case "seek": {
				const pos = Number(b.position);
				const dur = player.current?.info?.length || player.current?.info?.duration || 0;
				if (!Number.isFinite(pos) || pos < 0 || (dur && pos > dur)) {
					return res.status(400).json({ error: "posição inválida" });
				}
				return mutateAndReply(ctx, gid, () => player.seek(pos), res);
			}
			case "volume": {
				const vol = Number(b.volume);
				if (!Number.isFinite(vol) || vol < 0 || vol > 250) {
					return res.status(400).json({ error: "volume deve ser 0–250" });
				}
				return mutateAndReply(ctx, gid, () => player.setVolume(vol), res);
			}
			case "loop": {
				const mode = String(b.mode || "");
				if (!["off", "track", "queue"].includes(mode)) {
					return res.status(400).json({ error: "mode deve ser off/track/queue" });
				}
				return mutateAndReply(ctx, gid, () => player.setLoop(mode === "off" ? "none" : mode), res);
			}
			default:
				return res.status(400).json({ error: "ação desconhecida" });
		}
	});

	// POST /v2/guilds/:id/queue/:action — fila (remove/move/clear/jump)
	r.post("/:id/queue/:action", (req, res) => {
		const player = getPlayerOr404(ctx, req, res);
		if (!player) return;
		const { action } = req.params;
		const b = req.body || {};
		const gid = req.params.id;
		const qlen = typeof player.queue?.length === "number" ? player.queue.length : 0;

		switch (action) {
			case "remove": {
				const i = Number(b.index);
				if (!Number.isInteger(i) || i < 0 || i >= qlen) {
					return res.status(400).json({ error: "índice fora da fila" });
				}
				return mutateAndReply(ctx, gid, () => player.queue.remove(i), res);
			}
			case "move": {
				const from = Number(b.from);
				const to = Number(b.to);
				if (![from, to].every((n) => Number.isInteger(n) && n >= 0 && n < qlen)) {
					return res.status(400).json({ error: "índices fora da fila" });
				}
				return mutateAndReply(ctx, gid, () => {
					const t = player.queue[from];
					player.queue.splice(from, 1);
					player.queue.splice(to, 0, t);
				}, res);
			}
			case "clear":
				return mutateAndReply(ctx, gid, () => player.queue.clear(), res);
			case "jump": {
				const i = Number(b.index); // 0-based: pula para a queue[i]
				if (!Number.isInteger(i) || i < 0 || i >= qlen) {
					return res.status(400).json({ error: "índice fora da fila" });
				}
				// skip(i+1): descarta as i primeiras e toca a queue[i]. (player.queue.shift não existe no shim)
				return mutateAndReply(ctx, gid, () => { player.skip(i + 1, false).catch(() => {}); }, res);
			}
			default:
				return res.status(400).json({ error: "ação desconhecida" });
		}
	});

	// POST /v2/guilds/:id/filters — aplica um preset de filtro
	r.post("/:id/filters", (req, res) => {
		const player = getPlayerOr404(ctx, req, res);
		if (!player) return;
		const preset = String((req.body || {}).preset || "");
		const apply = FILTER_PRESETS[preset];
		if (!apply) {
			return res.status(400).json({ error: "preset inválido", presets: Object.keys(FILTER_PRESETS) });
		}
		if (!player.filters) return res.status(409).json({ error: "filtros indisponíveis" });
		return mutateAndReply(ctx, req.params.id, () => apply(player.filters), res);
	});

	return r;
};
