"use strict";

/**
 * apiv2 — API REST + WebSocket de tempo real do MinionsBot, para a dashboard nova.
 *
 * Separado do `api/` antigo (Passport + dashboard embutida) de propósito: roda em
 * porta própria (default 4201), sem sessão/cookie, autenticando por:
 *   - Bearer token (BOT_API_TOKEN) nas rotas REST /v2/*  (chamado pela Vercel)
 *   - ticket JWT no WebSocket /ws                          (chamado pelo browser)
 *
 * Exponha 4201 atrás de um proxy HTTPS (ex.: api.konbdemo.xyz) — veja deploy/.
 */

const express = require("express");
const expressWs = require("express-ws");
const RealtimeHub = require("./realtime");
const { bearerAuth } = require("./util/auth");

function corsMiddleware(allowedOrigins) {
	const allowAll = !allowedOrigins || allowedOrigins.length === 0;
	return (req, res, next) => {
		const origin = req.headers.origin;
		if (allowAll) {
			res.setHeader("Access-Control-Allow-Origin", origin || "*");
		} else if (origin && allowedOrigins.includes(origin)) {
			res.setHeader("Access-Control-Allow-Origin", origin);
			res.setHeader("Vary", "Origin");
		}
		res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
		res.setHeader("Access-Control-Max-Age", "600");
		if (req.method === "OPTIONS") return res.status(204).end();
		next();
	};
}

class ApiV2 {
	/** @param {import("../lib/DiscordMusicBot")} client */
	constructor(client) {
		this.client = client;
		// Usa config.apiv2 se existir; senão cai pro .env direto (config.js da VPS é
		// gitignored e pode não ter o bloco apiv2 após um git pull).
		const c = client.config?.apiv2 || {};
		this.cfg = {
			enabled: c.enabled !== undefined ? c.enabled : process.env.APIV2_ENABLED !== "false",
			port: c.port || Number(process.env.APIV2_PORT || 4201),
			token: c.token || process.env.BOT_API_TOKEN || "",
			realtimeSecret: c.realtimeSecret || process.env.REALTIME_SECRET || "",
			allowedOrigins:
				c.allowedOrigins && c.allowedOrigins.length
					? c.allowedOrigins
					: (process.env.DASHBOARD_ORIGINS || "http://localhost:3000")
							.split(",")
							.map((s) => s.trim())
							.filter(Boolean),
		};
		this.hub = null;
	}

	start() {
		if (this.cfg.enabled === false) {
			this.client.warn?.("[apiv2] desabilitado (config.apiv2.enabled = false)");
			return;
		}
		try {
			const app = express();
			expressWs(app);
			app.set("trust proxy", 1);
			// Rotas case-SENSITIVE: /Guilds ou /MOD viram 404 (defesa contra burla de auth por case).
			app.set("case sensitive routing", true);
			app.use(corsMiddleware(this.cfg.allowedOrigins));
			app.use(express.json({ limit: "1mb" }));

			// Health check sem auth (para o proxy/uptime monitor)
			app.get("/health", (_req, res) => {
				res.json({
					ok: true,
					ready: !!this.client.user,
					uptime: this.client.uptime || 0,
					ts: Date.now(),
				});
			});

			// WebSocket ao vivo
			this.hub = new RealtimeHub(this.client, this.cfg);
			const allowed = this.cfg.allowedOrigins || [];
			app.ws("/ws", (ws, req) => {
				const origin = req.headers.origin;
				// se há origens permitidas, exige Origin válido (origin ausente também é negado)
				if (allowed.length && (!origin || !allowed.includes(origin))) {
					this.client.warn?.(
						`[apiv2] WS recusado (origin "${origin}" não está em DASHBOARD_ORIGINS=${JSON.stringify(allowed)})`,
					);
					try {
						ws.close(4003, "origin not allowed");
					} catch {}
					return;
				}
				this.hub.handleConnection(ws, req);
			});
			this.hub.start();

			// REST /v2/* — tudo protegido por Bearer token
			const ctx = { client: this.client, cfg: this.cfg, hub: this.hub };
			const v2 = express.Router({ caseSensitive: true });
			v2.use(bearerAuth(this.cfg));
			v2.use("/", require("./routes/stats")(ctx));
			v2.use("/guilds", require("./routes/guilds")(ctx));
			v2.use("/guilds", require("./routes/player")(ctx));
			v2.use("/guilds", require("./routes/moderation")(ctx));
			v2.use("/economy", require("./routes/economy")(ctx));
			app.use("/v2", v2);

			// 404 + erro JSON
			v2.use((_req, res) => res.status(404).json({ error: "not found" }));
			app.use((err, _req, res, _next) => {
				this.client.error?.("[apiv2] " + (err?.stack || err?.message || err));
				res.status(500).json({ error: "internal error" });
			});

			const port = this.cfg.port || 4201; // fallback: nunca escutar em porta aleatória
			this.server = app.listen(port, () => {
				this.client.log?.(`[apiv2] REST+WS na porta ${port}`);
			});
		} catch (e) {
			this.client.error?.("[apiv2] falhou ao iniciar: " + (e?.stack || e?.message || e));
		}
	}
}

module.exports = ApiV2;
