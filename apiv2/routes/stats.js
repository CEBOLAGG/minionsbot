"use strict";

const { Router } = require("express");
const { buildStats } = require("../util/snapshot");

/** @param {{client:any,cfg:any,hub:any}} ctx */
module.exports = (ctx) => {
	const r = Router({ caseSensitive: true });

	// GET /v2/stats — estatísticas globais ao vivo (servers/users/players/nós lavalink)
	r.get("/stats", (_req, res) => {
		res.json(buildStats(ctx.client));
	});

	// GET /v2/commands — lista de slash commands (para a página de comandos)
	r.get("/commands", (_req, res) => {
		const cmds = [];
		try {
			ctx.client.slashCommands.forEach((cmd) => {
				cmds.push({
					name: cmd.name,
					description: cmd.description || "",
					category: cmd.category || null,
				});
			});
		} catch {}
		res.json({ count: cmds.length, commands: cmds.sort((a, b) => a.name.localeCompare(b.name)) });
	});

	return r;
};
