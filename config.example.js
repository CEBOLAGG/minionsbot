// ===========================================================================
// config.EXAMPLE.js
// Copie para `config.js` (que está no .gitignore) e preencha — ou deixe os
// segredos no `.env` (o docker-compose injeta no processo).  NUNCA comite o
// config.js real com segredos.
// ===========================================================================
module.exports = {
	// MongoDB (Atlas). Coloque sua connection string no .env como MONGO_URI.
	mongoUri: process.env.MONGO_URI || "",

	helpCmdPerPage: 10,
	lyricsMaxResults: 5,
	adminId: process.env.ADMIN_ID || "852599498323787838", // id do admin do bot
	token: process.env.token || "",               // token do bot  -> .env
	clientId: process.env.clientId || "",          // application id do bot
	clientSecret: process.env.clientSecret || "",  // client secret -> .env
	port: 4200,
	scopes: ["identify", "guilds", "applications.commands"],
	inviteScopes: ["bot", "applications.commands"],
	serverDeafen: true,
	defaultVolume: 100,
	supportServer: "https://discord.gg/mbqWNRHBrR",
	Issues: "https://discord.gg/mbqWNRHBrR",
	permissions: 8,
	disconnectTime: 300000,
	twentyFourSeven: false,
	autoQueue: false,
	autoPause: true,
	autoLeave: true,
	debug: false,
	futebolApiKey: process.env.FUTEBOL_API_KEY || "",
	oddsApiKey: process.env.ODDS_API_KEY || "",
	spotifyID: process.env.SPOTIFY_CLIENT_ID || "",
	spotifySecret: process.env.SPOTIFY_CLIENT_SECRET || "",
	cookieSecret: process.env.COOKIE_SECRET || "Coding",
	website: "https://konbdemo.xyz",

	// ===== apiv2: dashboard nova (REST + WebSocket em tempo real) — veja deploy/apiv2/ =====
	apiv2: {
		enabled: process.env.APIV2_ENABLED !== "false",
		port: Number(process.env.APIV2_PORT || 4201),
		token: process.env.BOT_API_TOKEN || "",
		realtimeSecret: process.env.REALTIME_SECRET || "",
		allowedOrigins: (process.env.DASHBOARD_ORIGINS || "http://localhost:3000")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
	},
	// sync antigo pro Mongo a cada 10s (desligado por padrão; a dashboard nova usa WebSocket)
	legacyMongoSync: process.env.LEGACY_MONGO_SYNC === "true",

	// Nó do Lavalink: local = localhost | docker = lavalink (o compose injeta LAVALINK_HOST)
	nodes: [
		{ identifier: "main", host: process.env.LAVALINK_HOST || "localhost", port: Number(process.env.LAVALINK_PORT) || 2333, password: process.env.LAVALINK_PASSWORD || "minionsbot2026", secure: false, retryAmount: 9999, retryDelay: 7000 },
	],

	embedColor: "#2f3136",
	presence: {
		status: "online",
		activities: [
			{
				name: "UPDATE TOP1 P1000 !!!!!!!!!",
				type: 1, // 0: Playing, 1: Streaming, 2: Listening, 3: Watching, 4: Custom, 5: Competing
				data: (client) => ({ someVariable: client.guilds.cache.size }),
			},
			{
				name: "TOP1 MUSIC BOT !!!!!!!!!",
				type: 2,
			},
		],
	},
	iconURL: "https://cdn.darrennathanael.com/icons/spinning_disk.gif",

	// IA (OpenRouter)
	openrouterKey: process.env.OPENROUTER_KEY || "",
	model: "openai/gpt-4.1-nano",

	lyricsApiUid: process.env.LYRICS_API_UID || "",
	lyricsApiToken: process.env.LYRICS_API_TOKEN || "",
	steamApiKey: process.env.STEAM_API_KEY,

	// Monitoramento do Lavalink (webhook do Discord -> .env)
	lavalinkMonitoring: {
		enabled: true,
		webhook: {
			url: process.env.LAVALINK_WEBHOOK_URL || "",
			username: "Lavalink Monitor",
			avatar: "https://cdn.darrennathanael.com/icons/spinning_disk.gif",
		},
		maxRetries: 2,
		alertCooldown: 180000,
		connectionTimeout: 30000,
		monitorEvents: {
			nodeError: true,
			nodeDisconnect: true,
			nodeDestroy: true,
			loadFailed: true,
			connectionFailed: true,
		},
	},
};
