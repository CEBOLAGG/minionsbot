"use strict";

const { Router } = require("express");
const fs = require("fs");
const path = require("path");

// Warnings vivem em db.json (mesmo store do commands/slash/warn.js).
// db.warnings[guildId][userId] = [{ moderator, reason, timestamp }]
const DB_PATH = path.join(process.cwd(), "db.json");

function readDb() {
	try {
		if (!fs.existsSync(DB_PATH)) return {};
		return JSON.parse(fs.readFileSync(DB_PATH, "utf8")) || {};
	} catch {
		return {};
	}
}
function writeDb(db) {
	fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}
function getWarnings(guildId, userId) {
	const db = readDb();
	return db?.warnings?.[guildId]?.[userId] || [];
}

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // 28 dias (limite do Discord)

/** @param {{client:any,cfg:any,hub:any}} ctx */
module.exports = (ctx) => {
	const r = Router({ caseSensitive: true });
	const { client } = ctx;

	function guildOr404(req, res) {
		const guild = client.guilds.cache.get(req.params.id);
		if (!guild) {
			res.status(404).json({ error: "bot não está nesse servidor" });
			return null;
		}
		return guild;
	}

	// GET /v2/guilds/:id/warnings/summary — contagem por usuário (ranking de warns)
	r.get("/:id/warnings/summary", (req, res) => {
		if (!guildOr404(req, res)) return;
		const db = readDb();
		const byUser = db?.warnings?.[req.params.id] || {};
		const summary = Object.entries(byUser)
			.map(([userId, list]) => ({ userId, count: Array.isArray(list) ? list.length : 0 }))
			.filter((x) => x.count > 0)
			.sort((a, b) => b.count - a.count);
		res.json(summary);
	});

	// GET /v2/guilds/:id/warnings?userId=... — warnings de um usuário
	r.get("/:id/warnings", (req, res) => {
		if (!guildOr404(req, res)) return;
		const userId = (req.query.userId || "").toString();
		if (!userId) return res.status(400).json({ error: "userId obrigatório" });
		const list = getWarnings(req.params.id, userId).map((w, i) => ({
			index: i,
			moderatorId: w.moderator || null,
			reason: w.reason || "Sem motivo",
			timestamp: w.timestamp || null,
		}));
		res.json({ userId, count: list.length, warnings: list });
	});

	// POST /v2/guilds/:id/warnings { userId, reason, moderatorId }
	r.post("/:id/warnings", (req, res) => {
		if (!guildOr404(req, res)) return;
		const { userId, reason, moderatorId } = req.body || {};
		if (!userId) return res.status(400).json({ error: "userId obrigatório" });
		const db = readDb();
		db.warnings = db.warnings || {};
		db.warnings[req.params.id] = db.warnings[req.params.id] || {};
		db.warnings[req.params.id][userId] = db.warnings[req.params.id][userId] || [];
		db.warnings[req.params.id][userId].push({
			moderator: moderatorId || "dashboard",
			reason: (reason || "Sem motivo").toString().slice(0, 1000),
			timestamp: Date.now(),
		});
		try {
			writeDb(db);
		} catch (e) {
			return res.status(500).json({ error: "falha ao salvar: " + (e?.message || e) });
		}
		res.json({ ok: true, count: db.warnings[req.params.id][userId].length });
	});

	// DELETE /v2/guilds/:id/warnings/:userId  (ou /:userId/:index para remover 1)
	r.delete("/:id/warnings/:userId/:index?", (req, res) => {
		if (!guildOr404(req, res)) return;
		const { userId, index } = req.params;
		const db = readDb();
		const list = db?.warnings?.[req.params.id]?.[userId];
		if (!Array.isArray(list) || !list.length) {
			return res.status(404).json({ error: "sem warnings" });
		}
		if (index !== undefined) {
			const i = Number(index);
			if (!Number.isInteger(i) || i < 0 || i >= list.length) {
				return res.status(400).json({ error: "índice inválido" });
			}
			list.splice(i, 1);
		} else {
			db.warnings[req.params.id][userId] = [];
		}
		try {
			writeDb(db);
		} catch (e) {
			return res.status(500).json({ error: "falha ao salvar: " + (e?.message || e) });
		}
		res.json({ ok: true, remaining: db.warnings[req.params.id][userId].length });
	});

	// GET /v2/guilds/:id/members/:userId — detalhe do membro (roles, entrada, warns, histórico)
	r.get("/:id/members/:userId", async (req, res) => {
		const guild = guildOr404(req, res);
		if (!guild) return;
		const member = await guild.members.fetch(req.params.userId).catch(() => null);
		const warnings = getWarnings(req.params.id, req.params.userId);

		let history = [];
		try {
			const { getUserHistory } = require("../../util/mongodb");
			const h = await getUserHistory(req.params.userId);
			// getUserHistory retorna o ARRAY de tracks direto (não {tracks})
			const arr = Array.isArray(h) ? h : h?.tracks || [];
			history = arr.slice(-15).reverse().map((t) => ({
				title: t.title,
				author: t.author,
				uri: t.uri,
				thumbnail: t.thumbnail,
				addedAt: t.addedAt,
			}));
		} catch {}

		if (!member) {
			return res.json({
				inGuild: false,
				userId: req.params.userId,
				warningsCount: warnings.length,
				history,
			});
		}
		res.json({
			inGuild: true,
			userId: member.id,
			tag: member.user.tag,
			displayName: member.displayName,
			avatar: member.user.displayAvatarURL({ size: 128 }),
			joinedAt: member.joinedTimestamp,
			createdAt: member.user.createdTimestamp,
			roles: member.roles.cache
				.filter((r) => r.id !== guild.id)
				.sort((a, b) => b.position - a.position)
				.map((r) => ({ id: r.id, name: r.name, color: r.hexColor })),
			isTimedOut: member.isCommunicationDisabled?.() || false,
			timeoutUntil: member.communicationDisabledUntilTimestamp || null,
			bannable: member.bannable,
			kickable: member.kickable,
			moderatable: member.moderatable,
			warningsCount: warnings.length,
			history,
		});
	});

	// POST /v2/guilds/:id/mod/:action { userId, reason, durationMs, moderatorId }
	// A Vercel JÁ valida que o usuário tem a permissão Discord específica (ban/kick/timeout).
	r.post("/:id/mod/:action", async (req, res) => {
		const guild = guildOr404(req, res);
		if (!guild) return;
		const { action } = req.params;
		const { userId, reason, durationMs, moderatorId } = req.body || {};
		if (!userId) return res.status(400).json({ error: "userId obrigatório" });
		const audit = `${reason || "Sem motivo"} | via dashboard${moderatorId ? ` (${moderatorId})` : ""}`;

		try {
			const member = await guild.members.fetch(userId).catch(() => null);

			switch (action) {
				case "ban":
					if (member && !member.bannable) return res.status(403).json({ error: "não posso banir esse membro" });
					await guild.members.ban(userId, { reason: audit });
					return res.json({ ok: true, action: "ban" });

				case "unban":
					await guild.bans.remove(userId, audit).catch(() => {
						throw new Error("usuário não está banido");
					});
					return res.json({ ok: true, action: "unban" });

				case "kick":
					if (!member) return res.status(404).json({ error: "membro não está no servidor" });
					if (!member.kickable) return res.status(403).json({ error: "não posso expulsar esse membro" });
					await member.kick(audit);
					return res.json({ ok: true, action: "kick" });

				case "mute": {
					if (!member) return res.status(404).json({ error: "membro não está no servidor" });
					if (!member.moderatable) return res.status(403).json({ error: "não posso silenciar esse membro" });
					const ms = Math.min(Number(durationMs) || 10 * 60 * 1000, MAX_TIMEOUT_MS);
					await member.timeout(ms, audit);
					return res.json({ ok: true, action: "mute", until: Date.now() + ms });
				}

				case "unmute":
					if (!member) return res.status(404).json({ error: "membro não está no servidor" });
					await member.timeout(null, audit);
					return res.json({ ok: true, action: "unmute" });

				default:
					return res.status(400).json({ error: "ação de moderação desconhecida" });
			}
		} catch (e) {
			return res.status(500).json({ error: "falha na ação: " + (e?.message || e) });
		}
	});

	return r;
};
