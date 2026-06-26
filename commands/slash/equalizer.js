const SlashCommand = require("../../lib/SlashCommand");
const { buildEqPanel, applyEq } = require("../../util/Equalizer");

const command = new SlashCommand()
	.setName("equalizer")
	.setDescription("Abre o equalizador interativo de 5 bandas (aplica ao vivo)")
	.setRun(async (client, interaction) => {
		const guildId = interaction.guild.id;
		const gains = (client.getPlayerData(guildId, "eqGains") || [0, 0, 0, 0, 0]).slice();
		const preset = client.getPlayerData(guildId, "eqPreset") || "Custom";

		client.setPlayerData(guildId, "eqGains", gains);
		// Sincroniza o player com o estado mostrado (se houver música tocando)
		applyEq(client, guildId, gains);

		return interaction.reply(buildEqPanel(client, guildId, gains, preset));
	});

module.exports = command;
