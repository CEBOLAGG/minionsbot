const { EmbedBuilder, Colors, escapeMarkdown } = require("discord.js");
const prettyMilliseconds = require("pretty-ms");
const { emojiFor, emojiTag } = require("../lib/emojis");

// Criar barra de progresso
function createProgressBar(current, total, length = 12) {
	const progress = Math.round((current / total) * length);
	const filled = "▰".repeat(Math.min(progress, length));
	const empty = "▱".repeat(Math.max(0, length - progress));
	const currentTime = prettyMilliseconds(current, { colonNotation: true, secondsDecimalDigits: 0 });
	const totalTime = prettyMilliseconds(total, { colonNotation: true, secondsDecimalDigits: 0 });
	return `${filled}${empty} \`${currentTime} / ${totalTime}\``;
}

/**
 *
 * @param {import("../lib/DiscordMusicBot")} client
 * @param {import("discord.js").StringSelectMenuInteraction} interaction
 */
module.exports = async (client, interaction) => {
	if (!interaction.isStringSelectMenu()) return;
	
	if (interaction.customId.startsWith("filters:")) {
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
		
		const filter = interaction.values[0];
		
		// Format the filter name for display
		const filterNames = {
			'off': 'Reset',
			'nightcore': 'Nightcore',
			'vaporwave': 'Vaporwave',
			'slow': 'Slow',
			'fast': 'Fast',
			'bassboost_low': 'BassBoost Low',
			'bassboost_medium': 'BassBoost Medium',
			'bassboost_high': 'BassBoost High',
			'8d': '8D Audio',
			'karaoke': 'Karaoke',
			'vibrato': 'Vibrato',
			'tremolo': 'Tremolo',
			'lowpass': 'Low Pass',
			'highpass': 'High Pass',
			'channelmix': 'Channel Mix',
			'distortion': 'Distortion',
			'compressor': 'Compressor',
			'gate': 'Gate'
		};
		const displayName = filterNames[filter] || filter.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
		
		try {
			// Reset all filters
			if (filter === "off") {
				player.filters.clearFilters();
			} else {
				// Apply the selected filter based on type
				switch (filter) {
					case "nightcore":
						player.filters.setTimescale({ speed: 1.25, pitch: 1.25, rate: 1.0 });
						break;
					case "vaporwave":
						player.filters.setTimescale({ speed: 0.85, pitch: 0.85, rate: 1.0 });
						break;
					case "slow":
						player.filters.setTimescale({ speed: 0.75, pitch: 1.0, rate: 1.0 });
						break;
					case "fast":
						player.filters.setTimescale({ speed: 1.5, pitch: 1.0, rate: 1.0 });
						break;
					case "bassboost_low":
						player.filters.setEqualizer([
							{ band: 0, gain: 0.3 },
							{ band: 1, gain: 0.3 },
							{ band: 2, gain: 0.2 },
							{ band: 3, gain: 0.1 },
							{ band: 4, gain: 0 },
						]);
						break;
					case "bassboost_medium":
						player.filters.setEqualizer([
							{ band: 0, gain: 0.6 },
							{ band: 1, gain: 0.5 },
							{ band: 2, gain: 0.3 },
							{ band: 3, gain: 0.06 },
							{ band: 4, gain: 0.06 },
							{ band: 5, gain: 0.23 },
							{ band: 6, gain: 0.12 },
							{ band: 7, gain: 0.2 },
							{ band: 8, gain: 0.2 },
							{ band: 9, gain: 0.2 },
						]);
						break;
					case "bassboost_high":
						player.filters.setEqualizer([
							{ band: 0, gain: 0.9 },
							{ band: 1, gain: 0.8 },
							{ band: 2, gain: 0.7 },
							{ band: 3, gain: 0.5 },
							{ band: 4, gain: 0.3 },
						]);
						break;
					case "8d":
						player.filters.set8D(true, { rotationHz: 0.2 });
						break;
					case "karaoke":
						player.filters.setKaraoke({ level: 1.0, monoLevel: 1.0, filterBand: 220, filterWidth: 100 });
						break;
					case "vibrato":
						player.filters.setVibrato({ frequency: 4, depth: 0.75 });
						break;
					case "tremolo":
						player.filters.setTremolo({ frequency: 4, depth: 0.75 });
						break;
					case "lowpass":
						player.filters.setLowPass({ smoothing: 20.0 });
						break;
					case "highpass":
						player.filters.setHighPass({ smoothing: 20.0 });
						break;
					case "channelmix":
						player.filters.setChannelMix({ leftToLeft: 1.0, leftToRight: 0.0, rightToLeft: 0.0, rightToRight: 1.0 });
						break;
					case "distortion":
						player.filters.setDistortion({ sinOffset: 0.0, sinScale: 1.0, cosOffset: 0.0, cosScale: 1.0, tanOffset: 0.0, tanScale: 1.0, offset: 0.0, scale: 1.0 });
						break;
					case "compressor":
						player.filters.setCompressor({ threshold: 0.5, knee: 2.0, ratio: 2.0, attack: 0.02, release: 0.1 });
						break;
					case "gate":
						player.filters.setGate({ threshold: 0.1, attack: 0.01, release: 0.1 });
						break;
				}
			}
			
			// Verificar se é uma mensagem do player
			const isPlayerMessage = interaction.message.flags?.has('IsComponentsV2') || 
				interaction.message.embeds?.[0]?.author?.name?.includes("Now Playing");
			
			if (isPlayerMessage) {
				// Se for o dropdown integrado no player
				const track = player.current;
				if (!track) {
					return interaction.deferUpdate();
				}
				
				// Fechar o dropdown de filtros após selecionar
				client.setPlayerData(actualGuildId, "showFilters", false);
				
				const useComponentsV2 = client.getPlayerData(actualGuildId, "useComponentsV2");
				const showVolume = client.getPlayerData(actualGuildId, "showVolume") || false;
				const currentPosition = client.getPlayerData(actualGuildId, "trackStartTime") 
					? Date.now() - client.getPlayerData(actualGuildId, "trackStartTime") 
					: 0;
				
				if (useComponentsV2) {
					// Usar Components V2 para atualizar
					return interaction.update(
						client.createPlayerV2(actualGuildId, player, track, { showFilters: false, showVolume, currentPosition })
					);
				} else {
					// Usar sistema antigo
					return interaction.update({
						components: client.createController(actualGuildId, player, { showFilters: false, showVolume }),
					});
				}
			} else {
				// Se for ephemeral, apenas confirmar
				return interaction.update({
					embeds: [
						new EmbedBuilder()
							.setColor(client.config.embedColor)
							.setDescription(`${emojiTag("success")} | **${displayName}** filter ${filter === 'off' ? 'has been reset' : 'is now active'}!`)
					],
					components: []
				});
			}
		} catch (error) {
			console.error("Filter error:", error);
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription(`${emojiTag("error")} | Error applying filter. This filter may not be supported.`)
				],
				ephemeral: true
			});
		}
	}
};
