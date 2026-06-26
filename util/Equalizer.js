const {
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
} = require("discord.js");
const { emojiFor, emojiTag } = require("../lib/emojis");

// 5 bandas de UI; cada uma controla 3 das 15 bandas reais do Lavalink (5*3=15).
const BANDS = [
	{ label: "60Hz" },
	{ label: "230Hz" },
	{ label: "910Hz" },
	{ label: "3.6k" },
	{ label: "14k" },
];

const STEP = 0.1;
const GMIN = -0.25;
const GMAX = 1.0;

const PRESETS = {
	flat: { name: "Flat", gains: [0, 0, 0, 0, 0] },
	bass: { name: "Bass Boost", gains: [0.35, 0.15, 0, 0, 0.05] },
	vocal: { name: "Vocal", gains: [-0.1, 0, 0.25, 0.2, 0] },
	rock: { name: "Rock", gains: [0.25, 0.1, -0.05, 0.1, 0.2] },
	pop: { name: "Pop", gains: [0.1, 0.05, 0.15, 0.1, 0.15] },
};

const round2 = (v) => Math.round(v * 100) / 100;
const clamp = (v) => round2(Math.max(GMIN, Math.min(GMAX, v)));

function center(s, w) {
	s = String(s);
	if (s.length >= w) return s.slice(0, w);
	const total = w - s.length;
	const left = Math.floor(total / 2);
	return " ".repeat(left) + s + " ".repeat(total - left);
}

// Gráfico de barras verticais (estilo equalizador) num bloco monoespaçado.
function renderBars(gains) {
	const W = 6;
	const H = 5;
	const heights = gains.map((g) => Math.round(((clamp(g) - GMIN) / (GMAX - GMIN)) * H)); // 0..5
	const lines = [];
	for (let r = H; r >= 1; r--) {
		lines.push(gains.map((_, i) => center(heights[i] >= r ? "██" : "··", W)).join(""));
	}
	lines.push(BANDS.map((b) => center(b.label, W)).join(""));
	lines.push(gains.map((g) => center((g >= 0 ? "+" : "") + g.toFixed(2), W)).join(""));
	return lines.join("\n");
}

// Mapeia as 5 bandas de UI para as 15 bandas reais do Lavalink.
function to15(gains) {
	const bands = [];
	for (let i = 0; i < 5; i++) {
		for (let j = 0; j < 3; j++) bands.push({ band: i * 3 + j, gain: clamp(gains[i] ?? 0) });
	}
	return bands;
}

// Aplica o EQ ao vivo no player (se houver). Os filtros do lavalink-client
// persistem no player entre faixas, então fica valendo a sessão toda.
function applyEq(client, guildId, gains) {
	const player = client.manager?.players?.get(guildId);
	if (player?.filters?.setEqualizer) {
		try {
			player.filters.setEqualizer(to15(gains));
		} catch (e) {
			client.error?.(`[eq] applyEq: ${e.message}`);
		}
	}
}

// Monta o painel (Container v2): linha de ➕, gráfico, linha de ➖, presets.
function buildEqPanel(client, guildId, gains, presetName) {
	const c = new ContainerBuilder().setAccentColor(0x5865f2);

	c.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(
			`## 🎚️ Equalizador  •  Preset: **${presetName || "Custom"}**\n` +
				`Use ${emojiTag("plus")} / ${emojiTag("minus")} em cada banda — aplica **ao vivo** na música tocando.`
		)
	);

	// ➕ em cima (uma por banda)
	c.addActionRowComponents(
		new ActionRowBuilder().addComponents(
			...BANDS.map((b, i) =>
				new ButtonBuilder()
					.setCustomId(`eq:up:${i}`)
					.setLabel(b.label)
					.setEmoji(emojiFor("plus"))
					.setStyle(ButtonStyle.Success)
			)
		)
	);

	// Gráfico de barras no meio
	c.addTextDisplayComponents(new TextDisplayBuilder().setContent("```\n" + renderBars(gains) + "\n```"));

	// ➖ embaixo (uma por banda)
	c.addActionRowComponents(
		new ActionRowBuilder().addComponents(
			...BANDS.map((b, i) =>
				new ButtonBuilder()
					.setCustomId(`eq:down:${i}`)
					.setLabel(b.label)
					.setEmoji(emojiFor("minus"))
					.setStyle(ButtonStyle.Danger)
			)
		)
	);

	c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

	// Presets + reset
	c.addActionRowComponents(
		new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId("eq:preset:flat").setLabel("Reset").setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId("eq:preset:bass").setLabel("Bass").setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId("eq:preset:vocal").setLabel("Vocal").setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId("eq:preset:rock").setLabel("Rock").setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId("eq:preset:pop").setLabel("Pop").setStyle(ButtonStyle.Primary)
		)
	);

	return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

// Handler dos botões eq:up:i / eq:down:i / eq:preset:x
async function handleEqButton(client, interaction) {
	try {
		const [, action, arg] = interaction.customId.split(":");
		const guildId = interaction.guild.id;

		// Se o bot está num canal de voz, exige estar no mesmo
		const botVc = interaction.guild.members.me?.voice?.channel;
		if (botVc && interaction.member.voice.channel?.id !== botVc.id) {
			return interaction.reply({
				content: "❌ Entra no meu canal de voz pra mexer no equalizador.",
				ephemeral: true,
			});
		}

		let gains = (client.getPlayerData(guildId, "eqGains") || [0, 0, 0, 0, 0]).slice();
		let presetName = client.getPlayerData(guildId, "eqPreset") || "Custom";

		if (action === "up") {
			const i = Number(arg);
			gains[i] = clamp((gains[i] ?? 0) + STEP);
			presetName = "Custom";
		} else if (action === "down") {
			const i = Number(arg);
			gains[i] = clamp((gains[i] ?? 0) - STEP);
			presetName = "Custom";
		} else if (action === "preset") {
			const p = PRESETS[arg] || PRESETS.flat;
			gains = p.gains.slice();
			presetName = p.name;
		}

		client.setPlayerData(guildId, "eqGains", gains);
		client.setPlayerData(guildId, "eqPreset", presetName);
		applyEq(client, guildId, gains);

		return interaction.update(buildEqPanel(client, guildId, gains, presetName));
	} catch (e) {
		client.error?.(`[eq] handler: ${e.message}`);
		return interaction.reply({ content: "❌ Erro no equalizador.", ephemeral: true }).catch(() => {});
	}
}

module.exports = { buildEqPanel, handleEqButton, applyEq };
