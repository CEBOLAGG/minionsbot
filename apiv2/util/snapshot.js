"use strict";

/**
 * snapshot.js — CONTRATO de dados do apiv2.
 *
 * Tudo que a dashboard consome (REST e WebSocket) sai daqui, para que REST e WS
 * falem exatamente a mesma língua. Se mudar um shape aqui, espelhe em
 * dashboardteste/lib/types.ts.
 *
 * Os reads são defensivos: o player é do lavalink-client (com shim estilo Riffy),
 * então campos podem vir em `track.info.X` OU `track.X`, `info.length` OU
 * `info.duration`, etc. Nunca deixamos um campo ausente derrubar o snapshot.
 */

const MAX_QUEUE = 100;

function num(v, d = 0) {
	const n = Number(v);
	return Number.isFinite(n) ? n : d;
}

/** Normaliza quem pediu a música (pode ser User do discord.js ou string). */
function normRequester(requester) {
	if (!requester) return null;
	if (typeof requester === "string") return { id: null, tag: requester, avatar: null };
	try {
		return {
			id: requester.id || null,
			tag: requester.tag || requester.username || requester.globalName || "Desconhecido",
			avatar:
				typeof requester.displayAvatarURL === "function"
					? requester.displayAvatarURL({ size: 64 })
					: requester.avatar || null,
		};
	} catch {
		return { id: null, tag: "Desconhecido", avatar: null };
	}
}

/** Normaliza uma track do lavalink-client para o shape do contrato. */
function normTrack(track) {
	if (!track) return null;
	const info = track.info || track;
	return {
		title: info.title || "Desconhecido",
		author: info.author || info.artist || "",
		uri: info.uri || null,
		duration: num(info.duration ?? info.length, 0),
		isStream: !!info.isStream,
		thumbnail: info.artworkUrl || info.thumbnail || info.image || null,
		sourceName: info.sourceName || null,
		requester: normRequester(track.requester ?? info.requester),
	};
}

function normLoop(loop) {
	if (loop === "track" || loop === "queue") return loop;
	return "off";
}

/** Lê a fila de forma resiliente (shim expõe `.tracks`, `.current`, `.length`). */
function readQueue(player) {
	const q = player.queue;
	if (!q) return [];
	const tracks = Array.isArray(q.tracks) ? q.tracks : Array.isArray(q) ? q : [];
	return tracks.slice(0, MAX_QUEUE).map(normTrack);
}

function queueLength(player) {
	const q = player.queue;
	if (!q) return 0;
	if (typeof q.length === "number") return q.length;
	if (Array.isArray(q.tracks)) return q.tracks.length;
	return 0;
}

/** Quais filtros/presets estão ativos (best-effort). */
function readFilters(player) {
	try {
		const f = player.filters || player.filterManager?.filters;
		if (!f) return [];
		const active = [];
		const data = player.filterManager?.data || f.data || f;
		if (data?.timescale) active.push("timescale");
		if (data?.equalizer && data.equalizer.length) active.push("equalizer");
		if (data?.karaoke) active.push("karaoke");
		if (data?.vibrato) active.push("vibrato");
		if (data?.tremolo) active.push("tremolo");
		if (data?.rotation || data?.["8d"]) active.push("8d");
		if (data?.lowPass) active.push("lowpass");
		if (data?.distortion) active.push("distortion");
		return active;
	} catch {
		return [];
	}
}

/**
 * Snapshot do player de uma guild.
 * @returns {object|null} null se não houver player ativo
 */
function buildPlayerSnapshot(client, guildId) {
	const player = client.manager?.players?.get(guildId);
	if (!player) return null;

	const current = player.queue?.current || player.current || null;
	let voiceChannel = null;
	const voiceChannelId = player.voiceChannelId || player.voiceChannel || null;
	try {
		const guild = client.guilds.cache.get(guildId);
		const vc = guild?.channels?.cache?.get(voiceChannelId);
		voiceChannel = vc?.name || null;
	} catch {}

	let listeners = 0;
	try {
		const guild = client.guilds.cache.get(guildId);
		const vc = guild?.channels?.cache?.get(voiceChannelId);
		if (vc?.members) listeners = vc.members.filter((m) => !m.user.bot).size;
	} catch {}

	return {
		connected: true,
		playing: !!current && !player.paused,
		paused: !!player.paused,
		volume: num(player.volume, 100),
		loop: normLoop(player.loop ?? player.repeatMode),
		position: num(player.position, 0),
		voiceChannelId,
		voiceChannel,
		listeners,
		filters: readFilters(player),
		nowPlaying: normTrack(current),
		queue: readQueue(player),
		queueLength: queueLength(player),
		updatedAt: Date.now(),
	};
}

/** Converte um Map/objeto de canais ({channelId: true}) em array de ids. */
function mapKeys(maybeMap) {
	if (!maybeMap) return [];
	if (maybeMap instanceof Map) return Array.from(maybeMap.keys());
	if (typeof maybeMap === "object") return Object.keys(maybeMap);
	return [];
}

/**
 * Snapshot completo de uma guild (settings + canais + roles + player).
 * @param {object} guildDoc documento cru do Mongo (getOrCreateGuild)
 */
function buildGuildSnapshot(client, guildId, guildDoc) {
	const guild = client.guilds.cache.get(guildId);
	if (!guild) return null;

	const channels = guild.channels.cache
		.filter((c) => c.type === 0 || c.type === 2 || c.type === 5) // text, voice, announcement
		.sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0))
		.first(200)
		.map((c) => ({ id: c.id, name: c.name, type: c.type === 2 ? "voice" : "text" }));

	const roles = guild.roles.cache
		.filter((r) => r.id !== guild.id) // tira @everyone
		.sort((a, b) => b.position - a.position)
		.first(200)
		.map((r) => ({ id: r.id, name: r.name, color: r.hexColor }));

	const d = guildDoc || {};
	return {
		id: guild.id,
		name: guild.name,
		icon: guild.icon,
		iconURL: guild.iconURL({ size: 128 }) || null,
		memberCount: guild.memberCount,
		ownerId: guild.ownerId,
		settings: {
			djOnly: !!d.djOnly,
			defaultVolume: num(d.volume, client.config?.defaultVolume ?? 100),
			twentyFourSeven: d.twentyFourSeven ?? client.config?.twentyFourSeven ?? false,
			autoQueue: d.autoQueue ?? client.config?.autoQueue ?? false,
			autoPause: d.autoPause ?? client.config?.autoPause ?? true,
			autoLeave: d.autoLeave ?? client.config?.autoLeave ?? true,
			vnwModeChannels: mapKeys(d.vnwModeChannels),
			ignorantModeChannels: mapKeys(d.ignorantModeChannels),
			toxicModeChannels: mapKeys(d.toxicModeChannels),
		},
		channels,
		roles,
		player: buildPlayerSnapshot(client, guildId),
	};
}

/** Status dos nós lavalink (best-effort sobre lavalink-client). */
function buildNodes(client) {
	try {
		const nodes = client.manager?.nodeManager?.nodes;
		if (!nodes) return [];
		return Array.from(nodes.values()).map((n) => ({
			id: n.id || n.options?.identifier || "node",
			connected: !!n.connected,
			players: num(n.stats?.players, 0),
			playingPlayers: num(n.stats?.playingPlayers, 0),
			cpuLavalink: num(n.stats?.cpu?.lavalinkLoad, 0),
			cpuSystem: num(n.stats?.cpu?.systemLoad, 0),
			memoryUsedMB: Math.round(num(n.stats?.memory?.used, 0) / 1024 / 1024),
			uptime: num(n.stats?.uptime, 0),
			ping: num(n.ping ?? n.stats?.ping, 0),
		}));
	} catch {
		return [];
	}
}

/** Snapshot global de estatísticas do bot. */
function buildStats(client) {
	let activePlayers = 0;
	let listeners = 0;
	try {
		if (client.manager?.players) {
			for (const [gid, p] of client.manager.players) {
				if (p.queue?.current || p.current) activePlayers++;
				try {
					const guild = client.guilds.cache.get(gid);
					const vc = guild?.channels?.cache?.get(p.voiceChannelId || p.voiceChannel);
					if (vc?.members) listeners += vc.members.filter((m) => !m.user.bot).size;
				} catch {}
			}
		}
	} catch {}
	return {
		bot: {
			id: client.user?.id || null,
			name: client.user?.username || "MinionsBot",
			avatar: client.user?.displayAvatarURL?.({ size: 128 }) || null,
			version: (() => {
				try {
					return require("../../package.json").version;
				} catch {
					return "6.0.0";
				}
			})(),
		},
		servers: client.guilds?.cache?.size || 0,
		users: client.users?.cache?.size || 0,
		channels: client.channels?.cache?.size || 0,
		commandsRan: num(client.commandsRan, 0),
		songsPlayed: num(client.songsPlayed, 0),
		uptime: num(client.uptime, 0),
		ping: num(client.ws?.ping, 0),
		activePlayers,
		listeners,
		nodes: buildNodes(client),
		updatedAt: Date.now(),
	};
}

module.exports = {
	buildPlayerSnapshot,
	buildGuildSnapshot,
	buildStats,
	buildNodes,
	normTrack,
	normRequester,
	MAX_QUEUE,
};
