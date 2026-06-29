const SlashCommand = require("../../lib/SlashCommand");
const { MessageFlags } = require("discord.js");
const { buildEqPanel, applyEq } = require("../../util/Equalizer");
const { emojiTag } = require("../../lib/emojis");

const command = new SlashCommand()
	.setName("equalizer")
	.setDescription("Liga/desliga o equalizador dentro do player (toggle)")
	.setRun(async (client, interaction) => {
		const guildId = interaction.guild.id;
		const player = client.manager?.players?.get(guildId);
		const track = player ? player.queue?.current || player.current : null;

		// Sem player / nada tocando
		if (!player || !track) {
			return interaction.reply({
				content: `${emojiTag("error")} Nada tocando agora — use /play primeiro.`,
				flags: MessageFlags.Ephemeral,
			});
		}

		const useV2 = client.getPlayerData(guildId, "useComponentsV2");
		const npMessage = client.getNowPlayingMessage(guildId);

		// Fallback: sem player V2 ou sem a mensagem do player → painel avulso (comportamento antigo)
		if (!useV2 || !npMessage || client.isMessageDeleted(npMessage)) {
			const gains = (client.getPlayerData(guildId, "eqGains") || [0, 0, 0, 0, 0]).slice();
			const preset = client.getPlayerData(guildId, "eqPreset") || "Custom";
			applyEq(client, guildId, gains);
			return interaction.reply(buildEqPanel(client, guildId, gains, preset));
		}

		// Toggle do EQ inline DENTRO do player (evita vários painéis separados)
		const turningOn = !(client.getPlayerData(guildId, "showEq") || false);
		client.setPlayerData(guildId, "showEq", turningOn);
		try { player.filters.clearFilters(); } catch {} // EQ é exclusivo com os outros filtros
		if (turningOn) {
			// fecha os outros painéis e aplica os ganhos atuais
			client.setPlayerData(guildId, "showVolume", false);
			client.setPlayerData(guildId, "showQueue", false);
			client.setPlayerData(guildId, "showFilters", false);
			applyEq(client, guildId, client.getPlayerData(guildId, "eqGains") || [0, 0, 0, 0, 0]);
		}

		// Confirma a interação primeiro (ack rápido), depois edita a mensagem do player
		await interaction.reply({
			content: `${emojiTag("stats")} Equalizador **${turningOn ? "ligado" : "desligado"}** no player.`,
			flags: MessageFlags.Ephemeral,
		}).catch(() => {});

		const currentPosition = client.getPlayerData(guildId, "trackStartTime")
			? Date.now() - client.getPlayerData(guildId, "trackStartTime")
			: 0;
		try {
			await npMessage.edit(
				client.createPlayerV2(guildId, player, track, { showFilters: false, showVolume: false, currentPosition })
			);
		} catch (e) {
			client.error?.(`[eq] /equalizer toggle: ${e.message}`);
		}
	});

module.exports = command;
