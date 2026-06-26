const SlashCommand = require("../../lib/SlashCommand");
const {EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, MessageFlags} = require("discord.js");
const math = require("mathjs"); // You'll need to install this: npm install mathjs

const command = new SlashCommand()
	.setName("calc")
	.setDescription("Opens an interactive calculator")
	.setRun(async (client, interaction) => {
		try {
			// Respond immediately to prevent timeout
			await interaction.reply({ content: "Opening calculator...", flags: MessageFlags.Ephemeral });
			
			// Create initial embed
			const embed = new EmbedBuilder()
				.setTitle("Calculator")
				.setDescription("```\n0\n```")
				.setColor(client.config.embedColor);
			
			// Create calculator buttons - Basic mode
			const row1 = new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId("calc_clear").setLabel("C").setStyle(ButtonStyle.Danger),
				new ButtonBuilder().setCustomId("calc_bracket1").setLabel("(").setStyle(ButtonStyle.Primary),
				new ButtonBuilder().setCustomId("calc_bracket2").setLabel(")").setStyle(ButtonStyle.Primary),
				new ButtonBuilder().setCustomId("calc_divide").setLabel("÷").setStyle(ButtonStyle.Primary)
			);
			
			const row2 = new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId("calc_7").setLabel("7").setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("calc_8").setLabel("8").setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("calc_9").setLabel("9").setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("calc_multiply").setLabel("×").setStyle(ButtonStyle.Primary)
			);
			
			const row3 = new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId("calc_4").setLabel("4").setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("calc_5").setLabel("5").setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("calc_6").setLabel("6").setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("calc_subtract").setLabel("-").setStyle(ButtonStyle.Primary)
			);
			
			const row4 = new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId("calc_1").setLabel("1").setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("calc_2").setLabel("2").setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("calc_3").setLabel("3").setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("calc_add").setLabel("+").setStyle(ButtonStyle.Primary)
			);
			
			// Modificado: adicionei o botão de alternância na linha 5
			const row5 = new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId("calc_0").setLabel("0").setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("calc_decimal").setLabel(".").setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId("calc_backspace").setLabel("⌫").setStyle(ButtonStyle.Danger),
				new ButtonBuilder().setCustomId("calc_equals").setLabel("=").setStyle(ButtonStyle.Success),
				new ButtonBuilder().setCustomId("calc_toggle").setLabel("Sci").setStyle(ButtonStyle.Primary)
			);
			
			// Scientific calculator buttons
			const sciRow1 = new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId("calc_sin").setLabel("sin").setStyle(ButtonStyle.Primary),
				new ButtonBuilder().setCustomId("calc_cos").setLabel("cos").setStyle(ButtonStyle.Primary),
				new ButtonBuilder().setCustomId("calc_tan").setLabel("tan").setStyle(ButtonStyle.Primary),
				new ButtonBuilder().setCustomId("calc_pi").setLabel("π").setStyle(ButtonStyle.Primary)
			);
			
			const sciRow2 = new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId("calc_sqrt").setLabel("√").setStyle(ButtonStyle.Primary),
				new ButtonBuilder().setCustomId("calc_pow").setLabel("^").setStyle(ButtonStyle.Primary),
				new ButtonBuilder().setCustomId("calc_log").setLabel("log").setStyle(ButtonStyle.Primary),
				new ButtonBuilder().setCustomId("calc_e").setLabel("e").setStyle(ButtonStyle.Primary)
			);
			
			// Send the calculator message to the channel
			const message = await interaction.channel.send({
				embeds: [embed],
				components: [row1, row2, row3, row4, row5]
			});
			
			// Current expression
			let expression = "0";
			// Track if we're showing scientific buttons
			let showingScientific = false;
			
			// Create collector for button interactions
			const collector = message.createMessageComponentCollector({
				filter: (i) => i.user.id === interaction.user.id,
				time: 300000 // 5 minutes
			});
			
			collector.on("collect", async (i) => {
				try {
					// Extract the button ID
					const id = i.customId.replace("calc_", "");
					
					// Handle toggle button
					if (id === "toggle") {
						showingScientific = !showingScientific;
						
						// Update the message with the appropriate rows
						await i.update({
							embeds: [embed],
							components: showingScientific 
								? [sciRow1, sciRow2, row3, row4, row5] 
								: [row1, row2, row3, row4, row5]
						});
						return;
					}
					
					// Handle different button presses
					switch (id) {
						case "clear":
							expression = "0";
							break;
						case "backspace":
							expression = expression === "0" ? "0" : expression.slice(0, -1) || "0";
							break;
						case "equals":
							try {
								// Evaluate the expression
								expression = math.evaluate(
									expression
										.replace(/×/g, "*")
										.replace(/÷/g, "/")
										.replace(/π/g, "pi")
								).toString();
							} catch (error) {
								expression = "Error";
							}
							break;
						case "add":
							expression = expression === "0" ? "0+" : expression + "+";
							break;
						case "subtract":
							expression = expression === "0" ? "0-" : expression + "-";
							break;
						case "multiply":
							expression = expression === "0" ? "0×" : expression + "×";
							break;
						case "divide":
							expression = expression === "0" ? "0÷" : expression + "÷";
							break;
						case "bracket1":
							expression = expression === "0" ? "(" : expression + "(";
							break;
						case "bracket2":
							expression = expression === "0" ? ")" : expression + ")";
							break;
						case "decimal":
							expression = expression === "0" ? "0." : expression + ".";
							break;
						case "sin":
							expression = expression === "0" ? "sin(" : expression + "sin(";
							break;
						case "cos":
							expression = expression === "0" ? "cos(" : expression + "cos(";
							break;
						case "tan":
							expression = expression === "0" ? "tan(" : expression + "tan(";
							break;
						case "sqrt":
							expression = expression === "0" ? "sqrt(" : expression + "sqrt(";
							break;
						case "pow":
							expression = expression === "0" ? "0^" : expression + "^";
							break;
						case "log":
							expression = expression === "0" ? "log10(" : expression + "log10(";
							break;
						case "pi":
							expression = expression === "0" ? "π" : expression + "π";
							break;
						case "e":
							expression = expression === "0" ? "e" : expression + "e";
							break;
						default:
							// For number buttons
							if (!isNaN(id)) {
								expression = expression === "0" ? id : expression + id;
							}
					}
					
					// Update the embed
					embed.setDescription(`\`\`\`\n${expression}\n\`\`\``);
					
					// Update the message with the appropriate rows
					await i.update({
						embeds: [embed],
						components: showingScientific 
							? [sciRow1, sciRow2, row3, row4, row5] 
							: [row1, row2, row3, row4, row5]
					});
				} catch (error) {
					console.error("Error in button interaction:", error);
					try {
						await i.reply({ content: "An error occurred. Please try again.", flags: MessageFlags.Ephemeral });
					} catch (replyError) {
						console.error("Error sending reply:", replyError);
					}
				}
			});
			
			collector.on("end", () => {
				try {
					// Get the current rows
					const currentRows = showingScientific 
						? [sciRow1, sciRow2, row3, row4, row5]
						: [row1, row2, row3, row4, row5];
					
					// Disable all buttons when the collector ends
					const disabledRows = currentRows.map(row => {
						const newRow = new ActionRowBuilder();
						row.components.forEach(button => {
							newRow.addComponents(
								new ButtonBuilder()
									.setCustomId(button.customId)
									.setLabel(button.label)
									.setStyle(button.style)
									.setDisabled(true)
							);
						});
						return newRow;
					});
					
					// Update the message with disabled buttons
					embed.setFooter({ text: "Calculator session ended" });
					message.edit({ embeds: [embed], components: disabledRows }).catch(() => {});
				} catch (error) {
					console.error("Error in collector end:", error);
				}
			});
		} catch (error) {
			console.error("Error in calculator command:", error);
			await interaction.followUp({ content: "An error occurred while creating the calculator. Please try again later.", flags: MessageFlags.Ephemeral });
		}
	});

module.exports = command;