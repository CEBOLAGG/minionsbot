const { EmbedBuilder, Colors } = require("discord.js");
const { emojiFor, emojiTag } = require("../lib/emojis");

/**
 *
 * @param {import("../lib/DiscordMusicBot")} client
 * @param {import("discord.js").StringSelectMenuInteraction} interaction
 */
module.exports = async (client, interaction) => {
	if (!interaction.isStringSelectMenu()) return;
	
	if (interaction.customId.startsWith("volume:")) {
		const guildId = interaction.customId.split(":")[1];
		
		// Usar o guild ID da interação se necessário
		const actualGuildId = guildId || interaction.guild?.id;
		
		let player = null;
		if (client.manager && client.manager.players) {
			player = client.manager.players.get(actualGuildId);
		}
		
		if (!player) {
			return interaction.reply({
				embeds: [
					client.Embed(`${emojiTag("error")} | **There is no player to control in this server.**`),
				],
				ephemeral: true
			});
		}
		
		const volumeLevel = parseInt(interaction.values[0]);
		
		try {
			player.setVolume(volumeLevel);
			
			// Fechar o dropdown de volume após selecionar
			client.setPlayerData(actualGuildId, "showVolume", false);
			
			const useComponentsV2 = client.getPlayerData(actualGuildId, "useComponentsV2");
			const showFilters = client.getPlayerData(actualGuildId, "showFilters") || false;
			const currentPosition = client.getPlayerData(actualGuildId, "trackStartTime") 
				? Date.now() - client.getPlayerData(actualGuildId, "trackStartTime") 
				: 0;
			
			const track = player.current;
			if (!track) {
				return interaction.deferUpdate();
			}
			
			if (useComponentsV2) {
				// Usar Components V2 para atualizar
				return interaction.update(
					client.createPlayerV2(actualGuildId, player, track, { showFilters, showVolume: false, currentPosition })
				);
			} else {
				// Usar sistema antigo
				return interaction.update({
					components: client.createController(actualGuildId, player, { showFilters, showVolume: false }),
				});
			}
		} catch (error) {
			console.error("Volume error:", error);
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription(`${emojiTag("error")} | Error setting volume.`)
				],
				ephemeral: true
			});
		}
	}
};

