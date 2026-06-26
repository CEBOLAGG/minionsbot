const SlashCommand = require("../../lib/SlashCommand");
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, Colors, escapeMarkdown } = require("discord.js");
const load = require("lodash");
const pms = require("pretty-ms");
const { emojiFor, emojiTag } = require("../../lib/emojis");

const command = new SlashCommand()
	.setName("queue")
	.setDescription("Shows the current queue")
	
	.setRun(async (client, interaction, options) => {
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
						.setDescription("There are no songs in the queue."),
				],
				ephemeral: true,
			});
		}
		
		if (!player.playing && !player.current) {
			const queueEmbed = new EmbedBuilder()
				.setColor(client.config.embedColor)
				.setDescription("There's nothing playing.");
			return interaction.reply({ embeds: [queueEmbed], ephemeral: true });
		}
		
		await interaction.deferReply().catch(() => {});
		
		const song = player.current;
		if (!song) {
			const queueEmbed = new EmbedBuilder()
				.setColor(client.config.embedColor)
				.setDescription("There's nothing playing.");
			return interaction.editReply({ embeds: [queueEmbed] });
		}
		
		var title = escapeMarkdown(song.info.title);
		title = title.replace(/\]/g, "");
		title = title.replace(/\[/g, "");
		
		if (!player.queue.length || player.queue.length === 0) {
			const queueEmbed = new EmbedBuilder()
				.setColor(client.config.embedColor)
				.setDescription(`**${emojiTag("audio")} | Now playing:** [${title}](${song.info.uri})`)
				.addFields(
					{
						name: "Duration",
						value: song.info.isStream
							? `\`LIVE\``
							: `\`${pms(player.position, { colonNotation: true })} / ${pms(
								song.info.length,
								{ colonNotation: true },
							)}\``,
						inline: true,
					},
					{
						name: "Volume",
						value: `\`${player.volume}\``,
						inline: true,
					},
					{
						name: "Total Tracks",
						value: `\`${player.queue.length}\``,
						inline: true,
					},
				);
			
			await interaction.editReply({ embeds: [queueEmbed] });
		} else {
			// Calcular duração total da fila
			let queueDuration = player.queue.reduce((acc, track) => {
				return acc + (track.info.isStream ? 0 : (track.info.length || 0));
			}, 0);
			
			const mapping = player.queue.map(
				(t, i) => `\` ${++i} \` [${t.info.title}](${t.info.uri}) [${t.info.requester || 'Unknown'}]`,
			);
			
			const chunk = load.chunk(mapping, 10);
			const pages = chunk.map((s) => s.join("\n"));
			let page = interaction.options.getNumber("page");
			if (!page) page = 0;
			if (page) page = page - 1;
			if (page > pages.length) page = 0;
			if (page < 0) page = 0;
			
			if (player.queue.length < 11) {
				const embedTwo = new EmbedBuilder()
					.setColor(client.config.embedColor)
					.setDescription(
						`**${emojiTag("audio")} | Now playing:** [${title}](${song.info.uri}) [${song.info.requester || 'Unknown'}]\n\n**Queued Tracks**\n${pages[page]}`,
					)
					.addFields(
						{
							name: "Track Duration",
							value: song.info.isStream
								? `\`LIVE\``
								: `\`${pms(player.position, { colonNotation: true })} / ${pms(
									song.info.length,
									{ colonNotation: true },
								)}\``,
							inline: true,
						},
						{
							name: "Total Tracks Duration",
							value: `\`${pms(queueDuration, { colonNotation: true })}\``,
							inline: true,
						},
						{
							name: "Total Tracks",
							value: `\`${player.queue.length}\``,
							inline: true,
						},
					)
					.setFooter({ text: `Page ${page + 1}/${pages.length}` });
				
				await interaction.editReply({ embeds: [embedTwo] }).catch(() => {});
			} else {
				const embedThree = new EmbedBuilder()
					.setColor(client.config.embedColor)
					.setDescription(
						`**${emojiTag("audio")} | Now playing:** [${title}](${song.info.uri}) [${song.info.requester || 'Unknown'}]\n\n**Queued Tracks**\n${pages[page]}`,
					)
					.addFields(
						{
							name: "Track Duration",
							value: song.info.isStream
								? `\`LIVE\``
								: `\`${pms(player.position, { colonNotation: true })} / ${pms(
									song.info.length,
									{ colonNotation: true },
								)}\``,
							inline: true,
						},
						{
							name: "Total Tracks Duration",
							value: `\`${pms(queueDuration, { colonNotation: true })}\``,
							inline: true,
						},
						{
							name: "Total Tracks",
							value: `\`${player.queue.length}\``,
							inline: true,
						},
					)
					.setFooter({ text: `Page ${page + 1}/${pages.length}` });
				
				const buttonOne = new ButtonBuilder()
					.setCustomId("queue_cmd_but_1_app")
					.setEmoji(emojiFor("skip"))
					.setStyle(ButtonStyle.Primary);
				const buttonTwo = new ButtonBuilder()
					.setCustomId("queue_cmd_but_2_app")
					.setEmoji(emojiFor("previous"))
					.setStyle(ButtonStyle.Primary);
				
				await interaction.editReply({
					embeds: [embedThree],
					components: [new ActionRowBuilder().addComponents([buttonTwo, buttonOne])],
				}).catch(() => {});
				
				const collector = interaction.channel.createMessageComponentCollector({
					filter: (b) => {
						if (b.user.id === interaction.user.id) {
							return true;
						} else {
							return b.reply({
								content: `Only **${interaction.user.tag}** can use this button.`,
								ephemeral: true,
							}).catch(() => {});
						}
					},
					time: 60000 * 5,
					idle: 30e3,
				});
				
				collector.on("collect", async (button) => {
					if (button.customId === "queue_cmd_but_1_app") {
						await button.deferUpdate().catch(() => {});
						page = page + 1 < pages.length ? ++page : 0;
						
						const currentSong = player.current;
						if (!currentSong) return;
						
						var currentTitle = escapeMarkdown(currentSong.info.title);
						currentTitle = currentTitle.replace(/\]/g, "");
						currentTitle = currentTitle.replace(/\[/g, "");
						
						const embedFour = new EmbedBuilder()
							.setColor(client.config.embedColor)
							.setDescription(
								`**${emojiTag("audio")} | Now playing:** [${currentTitle}](${currentSong.info.uri}) [${currentSong.info.requester || 'Unknown'}]\n\n**Queued Tracks**\n${pages[page]}`,
							)
							.addFields(
								{
									name: "Track Duration",
									value: currentSong.info.isStream
										? `\`LIVE\``
										: `\`${pms(player.position, { colonNotation: true })} / ${pms(
											currentSong.info.length,
											{ colonNotation: true },
										)}\``,
									inline: true,
								},
								{
									name: "Total Tracks Duration",
									value: `\`${pms(queueDuration, { colonNotation: true })}\``,
									inline: true,
								},
								{
									name: "Total Tracks",
									value: `\`${player.queue.length}\``,
									inline: true,
								},
							)
							.setFooter({ text: `Page ${page + 1}/${pages.length}` });
						
						await interaction.editReply({
							embeds: [embedFour],
							components: [new ActionRowBuilder().addComponents([buttonTwo, buttonOne])],
						});
					} else if (button.customId === "queue_cmd_but_2_app") {
						await button.deferUpdate().catch(() => {});
						page = page > 0 ? --page : pages.length - 1;
						
						const currentSong = player.current;
						if (!currentSong) return;
						
						var currentTitle = escapeMarkdown(currentSong.info.title);
						currentTitle = currentTitle.replace(/\]/g, "");
						currentTitle = currentTitle.replace(/\[/g, "");
						
						const embedFive = new EmbedBuilder()
							.setColor(client.config.embedColor)
							.setDescription(
								`**${emojiTag("audio")} | Now playing:** [${currentTitle}](${currentSong.info.uri}) [${currentSong.info.requester || 'Unknown'}]\n\n**Queued Tracks**\n${pages[page]}`,
							)
							.addFields(
								{
									name: "Track Duration",
									value: currentSong.info.isStream
										? `\`LIVE\``
										: `\`${pms(player.position, { colonNotation: true })} / ${pms(
											currentSong.info.length,
											{ colonNotation: true },
										)}\``,
									inline: true,
								},
								{
									name: "Total Tracks Duration",
									value: `\`${pms(queueDuration, { colonNotation: true })}\``,
									inline: true,
								},
								{
									name: "Total Tracks",
									value: `\`${player.queue.length}\``,
									inline: true,
								},
							)
							.setFooter({ text: `Page ${page + 1}/${pages.length}` });
						
						await interaction.editReply({
							embeds: [embedFive],
							components: [new ActionRowBuilder().addComponents([buttonTwo, buttonOne])],
						}).catch(() => {});
					}
				});
			}
		}
	});

module.exports = command;
