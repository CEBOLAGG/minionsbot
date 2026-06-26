const { Router } = require("express");
const { PermissionsBitField } = require("discord.js");
const api = Router();
const { getClient } = require("../../");
const Auth = require("../middlewares/auth");
const { getGuildSettings } = require("../../util/guildDb");

const MANAGE_GUILD = PermissionsBitField.Flags.ManageGuild;

/**
 * GET /api/servers — list user's guilds with manage permission
 */
api.get("/", Auth, async (req, res) => {
	try {
		const client = getClient();
		const guilds = req.user?.profile?.guilds;

		if (!guilds || !Array.isArray(guilds)) {
			return res.json([]);
		}

		const manageable = guilds.filter((g) => {
			const perms = BigInt(g.permissions);
			return (perms & BigInt(0x20)) === BigInt(0x20) || // MANAGE_GUILD
				(perms & BigInt(0x8)) === BigInt(0x8); // ADMINISTRATOR
		});

		const result = manageable.map((g) => ({
			id: g.id,
			name: g.name,
			icon: g.icon,
			owner: g.owner,
			permissions: g.permissions,
			hasBot: client.guilds.cache.has(g.id),
		}));

		res.json(result);
	} catch (error) {
		console.error("Error fetching servers:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

/**
 * GET /api/servers/:id — get guild details + player + settings
 */
api.get("/:id", Auth, async (req, res) => {
	try {
		const client = getClient();
		const guildId = req.params.id;

		// Verify user has access to this guild
		const guilds = req.user?.profile?.guilds;
		if (!guilds || !Array.isArray(guilds)) {
			return res.status(403).json({ error: "Forbidden" });
		}

		const userGuild = guilds.find((g) => g.id === guildId);
		if (!userGuild) {
			return res.status(403).json({ error: "Forbidden" });
		}

		const perms = BigInt(userGuild.permissions);
		if ((perms & BigInt(0x20)) !== BigInt(0x20) && (perms & BigInt(0x8)) !== BigInt(0x8)) {
			return res.status(403).json({ error: "Insufficient permissions" });
		}

		const guild = client.guilds.cache.get(guildId);
		if (!guild) {
			return res.status(404).json({ error: "Bot is not in this server" });
		}

		// Get guild settings from DB
		let guildSettings = {};
		try {
			guildSettings = await getGuildSettings(guildId) || {};
		} catch (e) {
			// Fallback to defaults
		}

		// Get player data
		const player = client.manager?.players?.get(guildId);
		let nowPlaying = null;
		let queue = [];
		let voiceChannel = null;

		if (player) {
			const track = player.current;
			if (track) {
				nowPlaying = {
					title: track.info?.title || "Unknown",
					duration: track.info?.length || 0,
					position: player.position || 0,
					requester: track.info?.requester?.toString() || "Unknown",
					thumbnail: track.info?.artworkUrl || track.info?.thumbnail || null,
					uri: track.info?.uri || null,
					isStream: track.info?.isStream || false,
				};
			}

			if (player.queue && player.queue.length > 0) {
				queue = player.queue.map((t) => ({
					title: t.info?.title || "Unknown",
					duration: t.info?.length || 0,
					uri: t.info?.uri || null,
					requester: t.info?.requester?.toString() || "Unknown",
				}));
			}

			// Try to get voice channel name
			try {
				const vc = guild.channels.cache.get(player.voiceChannel);
				voiceChannel = vc?.name || null;
			} catch (e) {}
		}

		res.json({
			id: guild.id,
			name: guild.name,
			icon: guild.icon,
			memberCount: guild.memberCount,
			djOnly: guildSettings.djOnly || false,
			defaultVolume: guildSettings.defaultVolume ?? client.config.defaultVolume ?? 100,
			twentyFourSeven: guildSettings.twentyFourSeven ?? client.config.twentyFourSeven ?? false,
			autoQueue: guildSettings.autoQueue ?? client.config.autoQueue ?? false,
			autoPause: guildSettings.autoPause ?? client.config.autoPause ?? true,
			autoLeave: guildSettings.autoLeave ?? client.config.autoLeave ?? true,
			vnwMode: {
				enabled: guildSettings.vnwMode?.enabled || false,
				channelId: guildSettings.vnwMode?.channelId || null,
			},
			ignorantMode: {
				enabled: guildSettings.ignorantMode?.enabled || false,
				channelId: guildSettings.ignorantMode?.channelId || null,
			},
			nowPlaying,
			queue,
			voiceChannel,
		});
	} catch (error) {
		console.error("Error fetching server:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

/**
 * PATCH /api/servers/:id — update guild settings
 */
api.patch("/:id", Auth, async (req, res) => {
	try {
		const client = getClient();
		const guildId = req.params.id;

		// Verify user has access
		const guilds = req.user?.profile?.guilds;
		if (!guilds || !Array.isArray(guilds)) {
			return res.status(403).json({ error: "Forbidden" });
		}

		const userGuild = guilds.find((g) => g.id === guildId);
		if (!userGuild) {
			return res.status(403).json({ error: "Forbidden" });
		}

		const perms = BigInt(userGuild.permissions);
		if ((perms & BigInt(0x20)) !== BigInt(0x20) && (perms & BigInt(0x8)) !== BigInt(0x8)) {
			return res.status(403).json({ error: "Insufficient permissions" });
		}

		if (!client.guilds.cache.has(guildId)) {
			return res.status(404).json({ error: "Bot is not in this server" });
		}

		const {
			setDjOnly,
			setVolume,
			set247,
			setAutoQueue,
			setAutoPause,
			setAutoLeave,
		} = require("../../util/guildDb");

		const body = req.body;

		// Only update fields that are provided
		if (typeof body.djOnly === "boolean") {
			await setDjOnly(guildId, body.djOnly);
		}
		if (typeof body.defaultVolume === "number" && body.defaultVolume >= 1 && body.defaultVolume <= 150) {
			await setVolume(guildId, body.defaultVolume);
		}
		if (typeof body.twentyFourSeven === "boolean") {
			await set247(guildId, body.twentyFourSeven);
		}
		if (typeof body.autoQueue === "boolean") {
			await setAutoQueue(guildId, body.autoQueue);
		}
		if (typeof body.autoPause === "boolean") {
			await setAutoPause(guildId, body.autoPause);
		}
		if (typeof body.autoLeave === "boolean") {
			await setAutoLeave(guildId, body.autoLeave);
		}

		res.json({ success: true });
	} catch (error) {
		console.error("Error updating server:", error);
		res.status(500).json({ error: "Internal server error" });
	}
});

module.exports = api;
