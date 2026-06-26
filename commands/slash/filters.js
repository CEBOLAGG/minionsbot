const { EmbedBuilder, Colors, MessageFlags } = require("discord.js");
const SlashCommand = require("../../lib/SlashCommand");
const { emojiFor, emojiTag } = require("../../lib/emojis");

const command = new SlashCommand()
	.setName("filters")
	.setDescription("add or remove filters")
	.addStringOption((option) =>
		option
			.setName("preset")
			.setDescription("the preset to add")
			.setRequired(true)
			.addChoices(
				{ name: "Reset", value: "off" },
				{ name: "Nightcore", value: "nightcore" },
				{ name: "Vaporwave", value: "vaporwave" },
				{ name: "Slow", value: "slow" },
				{ name: "Fast", value: "fast" },
				{ name: "BassBoost Low", value: "bassboost_low" },
				{ name: "BassBoost Medium", value: "bassboost_medium" },
				{ name: "BassBoost High", value: "bassboost_high" },
				{ name: "8D", value: "8d" },
				{ name: "Karaoke", value: "karaoke" },
				{ name: "Vibrato", value: "vibrato" },
				{ name: "Tremolo", value: "tremolo" },
				{ name: "Low Pass", value: "lowpass" },
				{ name: "High Pass", value: "highpass" },
				{ name: "Channel Mix", value: "channelmix" },
				{ name: "Distortion", value: "distortion" },
				{ name: "Compressor", value: "compressor" },
				{ name: "Gate", value: "gate" },
			),
	)
	
	.setRun(async (client, interaction, options) => {
		const args = interaction.options.getString("preset");
		
		let channel = await client.getChannel(client, interaction);
		if (!channel) {
			return;
		}
		
		let player;
		if (client.manager) {
			player = client.manager.players.get(interaction.guild.id);
		} else {
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription("Lavalink node is not connected"),
				],
			});
		}
		
		if (!player) {
			return interaction.reply({
				embeds: [
					new EmbedBuilder()
						.setColor(Colors.Red)
						.setDescription("There's no music playing."),
				],
				flags: MessageFlags.Ephemeral,
			});
		}
		
		let filtersEmbed = new EmbedBuilder().setColor(client.config.embedColor);
		
		// Riffy usa player.filters para aplicar filtros
		// Os filtros do Lavalink v4 são diferentes
		try {
			if (args === "off") {
				filtersEmbed.setDescription(`${emojiTag("success")} | All filters have been reset!`);
				player.filters.clearFilters();
			} else if (args === "nightcore") {
				filtersEmbed.setDescription(`${emojiTag("success")} | Nightcore filter is now active!`);
				player.filters.setTimescale({ speed: 1.25, pitch: 1.25, rate: 1.0 });
			} else if (args === "vaporwave") {
				filtersEmbed.setDescription(`${emojiTag("success")} | Vaporwave filter is now on!`);
				player.filters.setTimescale({ speed: 0.85, pitch: 0.85, rate: 1.0 });
			} else if (args === "slow") {
				filtersEmbed.setDescription(`${emojiTag("success")} | Slow filter is now on!`);
				player.filters.setTimescale({ speed: 0.75, pitch: 1.0, rate: 1.0 });
			} else if (args === "fast") {
				filtersEmbed.setDescription(`${emojiTag("success")} | Fast filter is now on!`);
				player.filters.setTimescale({ speed: 1.5, pitch: 1.0, rate: 1.0 });
			} else if (args === "bassboost_low") {
				filtersEmbed.setDescription(`${emojiTag("success")} | BassBoost Low filter is now on!`);
				player.filters.setEqualizer([
					{ band: 0, gain: 0.3 },
					{ band: 1, gain: 0.3 },
					{ band: 2, gain: 0.2 },
					{ band: 3, gain: 0.1 },
					{ band: 4, gain: 0 },
				]);
			} else if (args === "bassboost_medium") {
				filtersEmbed.setDescription(`${emojiTag("success")} | BassBoost Medium filter is now on!`);
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
			} else if (args === "bassboost_high") {
				filtersEmbed.setDescription(`${emojiTag("success")} | BassBoost High filter is now on!`);
				player.filters.setEqualizer([
					{ band: 0, gain: 0.9 },
					{ band: 1, gain: 0.8 },
					{ band: 2, gain: 0.7 },
					{ band: 3, gain: 0.5 },
					{ band: 4, gain: 0.3 },
				]);
			} else if (args === "8d") {
				filtersEmbed.setDescription(`${emojiTag("success")} | 8D filter is now on!`);
				player.filters.set8D(true, { rotationHz: 0.2 });
			} else if (args === "karaoke") {
				filtersEmbed.setDescription(`${emojiTag("success")} | Karaoke filter is now on!`);
				player.filters.setKaraoke({ level: 1.0, monoLevel: 1.0, filterBand: 220, filterWidth: 100 });
			} else if (args === "vibrato") {
				filtersEmbed.setDescription(`${emojiTag("success")} | Vibrato filter is now on!`);
				player.filters.setVibrato({ frequency: 4, depth: 0.75 });
			} else if (args === "tremolo") {
				filtersEmbed.setDescription(`${emojiTag("success")} | Tremolo filter is now on!`);
				player.filters.setTremolo({ frequency: 4, depth: 0.75 });
			} else if (args === "lowpass") {
				filtersEmbed.setDescription(`${emojiTag("success")} | Low Pass filter is now on!`);
				player.filters.setLowPass({ smoothing: 20.0 });
			} else if (args === "highpass") {
				filtersEmbed.setDescription(`${emojiTag("success")} | High Pass filter is now on!`);
				player.filters.setHighPass({ smoothing: 20.0 });
			} else if (args === "channelmix") {
				filtersEmbed.setDescription(`${emojiTag("success")} | Channel Mix filter is now on!`);
				player.filters.setChannelMix({ leftToLeft: 1.0, leftToRight: 0.0, rightToLeft: 0.0, rightToRight: 1.0 });
			} else if (args === "distortion") {
				filtersEmbed.setDescription(`${emojiTag("success")} | Distortion filter is now on!`);
				player.filters.setDistortion({ sinOffset: 0.0, sinScale: 1.0, cosOffset: 0.0, cosScale: 1.0, tanOffset: 0.0, tanScale: 1.0, offset: 0.0, scale: 1.0 });
			} else if (args === "compressor") {
				filtersEmbed.setDescription(`${emojiTag("success")} | Compressor filter is now on!`);
				player.filters.setCompressor({ threshold: 0.5, knee: 2.0, ratio: 2.0, attack: 0.02, release: 0.1 });
			} else if (args === "gate") {
				filtersEmbed.setDescription(`${emojiTag("success")} | Gate filter is now on!`);
				player.filters.setGate({ threshold: 0.1, attack: 0.01, release: 0.1 });
			} else {
				filtersEmbed.setDescription(`${emojiTag("error")} | Invalid filter!`);
			}
		} catch (error) {
			console.error("Filter error:", error);
			filtersEmbed.setDescription(`${emojiTag("error")} | Error applying filter. This filter may not be supported.`);
		}
		
		return interaction.reply({ embeds: [filtersEmbed] });
	});

module.exports = command;
