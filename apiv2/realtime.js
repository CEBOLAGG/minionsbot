"use strict";

/**
 * RealtimeHub — servidor WebSocket ao vivo do apiv2.
 *
 * Fluxo:
 *  - O browser conecta em /ws?ticket=<JWT assinado pela Vercel>.
 *  - O ticket carrega { userId, guildIds } (as guilds que o usuário pode gerenciar).
 *  - O cliente manda {type:"watch", guildId} para escolher qual servidor observar.
 *    Só aceitamos guildId que esteja na lista do ticket.
 *  - Um tick (2s) constrói o snapshot do player das guilds observadas e envia.
 *    Stats globais vão para todos a cada ~5s. Tudo em memória — zero Mongo.
 *
 * É barato: só roda para guilds com pelo menos um espectador na dashboard.
 */

const { buildPlayerSnapshot, buildStats } = require("./util/snapshot");
const { verifyTicket } = require("./util/auth");

const PLAYER_TICK_MS = 2000;
const STATS_TICK_MS = 5000;
const HEARTBEAT_MS = 30000;

class RealtimeHub {
	/**
	 * @param {import("../lib/DiscordMusicBot")} client
	 * @param {object} cfg apiv2 config
	 */
	constructor(client, cfg) {
		this.client = client;
		this.cfg = cfg;
		/** @type {Set<import("ws")>} */
		this.conns = new Set();
		this._timers = [];
		this._hookManager();
	}

	/** Anexa um socket recém-conectado (chamado pelo app.ws). */
	handleConnection(ws, req) {
		let payload;
		try {
			const url = new URL(req.url, "http://localhost");
			const ticket = url.searchParams.get("ticket");
			payload = verifyTicket(ticket, this.cfg);
		} catch (e) {
			try {
				ws.send(JSON.stringify({ type: "error", message: "invalid ticket" }));
			} catch {}
			return ws.close(4001, "invalid ticket");
		}

		ws.meta = {
			userId: payload.userId || null,
			allowed: new Set(payload.guildIds || []),
			watching: null,
			alive: true,
		};
		this.conns.add(ws);

		ws.send(
			JSON.stringify({
				type: "hello",
				userId: ws.meta.userId,
				guildIds: Array.from(ws.meta.allowed),
				serverTime: Date.now(),
			}),
		);
		// manda stats imediatamente
		this._safeSend(ws, { type: "stats", data: buildStats(this.client) });

		ws.on("message", (raw) => this._onMessage(ws, raw));
		ws.on("pong", () => {
			if (ws.meta) ws.meta.alive = true;
		});
		ws.on("close", () => this.conns.delete(ws));
		ws.on("error", () => {
			this.conns.delete(ws);
			try {
				ws.close();
			} catch {}
		});
	}

	_onMessage(ws, raw) {
		let msg;
		try {
			msg = JSON.parse(raw.toString());
		} catch {
			return;
		}
		if (!msg || typeof msg !== "object") return;

		switch (msg.type) {
			case "watch": {
				const gid = String(msg.guildId || "");
				if (!ws.meta.allowed.has(gid)) {
					return this._safeSend(ws, { type: "error", message: "forbidden guild" });
				}
				ws.meta.watching = gid;
				// envia o snapshot atual na hora
				this._safeSend(ws, {
					type: "player",
					guildId: gid,
					data: buildPlayerSnapshot(this.client, gid),
				});
				break;
			}
			case "unwatch":
				ws.meta.watching = null;
				break;
			case "ping":
				this._safeSend(ws, { type: "pong", t: Date.now() });
				break;
		}
	}

	/** Dispara um broadcast imediato do player de uma guild (usado pelas rotas). */
	pushPlayer(guildId) {
		const data = buildPlayerSnapshot(this.client, guildId);
		for (const ws of this.conns) {
			if (ws.meta?.watching === guildId) {
				this._safeSend(ws, { type: "player", guildId, data });
			}
		}
	}

	/** Conjunto de guilds que têm pelo menos um espectador agora. */
	_watchedGuilds() {
		const set = new Set();
		for (const ws of this.conns) {
			if (ws.meta?.watching) set.add(ws.meta.watching);
		}
		return set;
	}

	start() {
		this._timers.push(
			setInterval(() => {
				const watched = this._watchedGuilds();
				if (!watched.size) return;
				const cache = new Map();
				for (const gid of watched) cache.set(gid, buildPlayerSnapshot(this.client, gid));
				for (const ws of this.conns) {
					const gid = ws.meta?.watching;
					if (gid && cache.has(gid)) {
						this._safeSend(ws, { type: "player", guildId: gid, data: cache.get(gid) });
					}
				}
			}, PLAYER_TICK_MS),
		);

		this._timers.push(
			setInterval(() => {
				if (!this.conns.size) return;
				const data = buildStats(this.client);
				for (const ws of this.conns) this._safeSend(ws, { type: "stats", data });
			}, STATS_TICK_MS),
		);

		// heartbeat: mata conexões mortas
		this._timers.push(
			setInterval(() => {
				for (const ws of this.conns) {
					if (!ws.meta) continue;
					if (ws.meta.alive === false) {
						this.conns.delete(ws);
						try {
							ws.terminate();
						} catch {}
						continue;
					}
					ws.meta.alive = false;
					try {
						ws.ping();
					} catch {}
				}
			}, HEARTBEAT_MS),
		);
	}

	stop() {
		for (const t of this._timers) clearInterval(t);
		this._timers = [];
	}

	/** Conecta nos eventos do manager para empurrar updates na hora. */
	_hookManager() {
		const m = this.client.manager;
		if (!m || typeof m.on !== "function") return;
		const immediate = (player) => {
			const gid = player?.guildId || player?.guild;
			if (gid) setImmediate(() => this.pushPlayer(gid));
		};
		// Nomes podem variar entre versões/shim — registramos defensivamente.
		for (const ev of [
			"trackStart",
			"trackEnd",
			"trackStuck",
			"queueEnd",
			"playerCreate",
			"playerDestroy",
			"playerDisconnect",
			"playerMove",
		]) {
			try {
				m.on(ev, (player) => immediate(player));
			} catch {}
		}
	}

	_safeSend(ws, obj) {
		try {
			if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
		} catch {}
	}
}

module.exports = RealtimeHub;
