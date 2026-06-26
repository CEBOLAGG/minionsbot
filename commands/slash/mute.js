const SlashCommand = require("../../lib/SlashCommand");
const { 
    EmbedBuilder, 
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Colors,
    MessageFlags,
    ChannelType
} = require("discord.js");

const command = new SlashCommand()
    .setName("mute")
    .setDescription("Mute a user in the server")
    .addUserOption(option =>
        option
            .setName("user")
            .setDescription("The user to mute")
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName("reason")
            .setDescription("Reason for muting the user")
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName("duration")
            .setDescription("Duration of the mute (e.g. 1h, 1d, 7d) - leave empty for permanent")
            .setRequired(false)
    )
    .setRun(async (client, interaction) => {
        // Check if the user has permission to moderate members
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({
                content: "You don't have permission to mute members!",
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const targetUser = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason") || "No reason provided";
        const durationString = interaction.options.getString("duration");

        // Check if the user is valid
        if (!targetUser) {
            return interaction.editReply({
                content: "Please provide a valid user to mute."
            });
        }

        // Check if the user is trying to mute themselves
        if (targetUser.id === interaction.user.id) {
            return interaction.editReply({
                content: "You cannot mute yourself!"
            });
        }

        // Check if the user is trying to mute the bot
        if (targetUser.id === client.user.id) {
            return interaction.editReply({
                content: "I cannot mute myself!"
            });
        }

        try {
            // Get the member object
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            // Check if user is in the server
            if (!targetMember) {
                return interaction.editReply({
                    content: "This user is not in the server!"
                });
            }

            // Check if the user trying to mute has a higher role than the target
            if (interaction.member.roles.highest.position <= targetMember.roles.highest.position && 
                interaction.guild.ownerId !== interaction.user.id) {
                return interaction.editReply({
                    content: "You cannot mute this user as they have the same or higher role than you!"
                });
            }

            // Parse duration if provided
            let duration = null;
            let durationMs = 0;
            if (durationString) {
                const durationRegex = /^(\d+)([hdwm])$/;
                const match = durationString.match(durationRegex);
                
                if (!match) {
                    return interaction.editReply({
                        content: "Invalid duration format. Please use format like 1h, 1d, 1w, 1m (hours, days, weeks, months)."
                    });
                }
                
                const value = parseInt(match[1]);
                const unit = match[2];
                
                switch (unit) {
                    case 'h': durationMs = value * 60 * 60 * 1000; break;
                    case 'd': durationMs = value * 24 * 60 * 60 * 1000; break;
                    case 'w': durationMs = value * 7 * 24 * 60 * 60 * 1000; break;
                    case 'm': durationMs = value * 30 * 24 * 60 * 60 * 1000; break;
                }
                
                if (durationMs > 0) {
                    duration = new Date(Date.now() + durationMs);
                }
            }

            // Get or create muted role
            let mutedRole = interaction.guild.roles.cache.find(role => role.name === "Muted");
            
            if (!mutedRole) {
                // Create a new muted role if it doesn't exist
                mutedRole = await interaction.guild.roles.create({
                    name: "Muted",
                    color: "#808080",
                    reason: "Needed for mute command",
                    permissions: []
                });
                
                // Set permissions for the muted role in all channels
                for (const channel of interaction.guild.channels.cache.values()) {
                    try {
                        if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
                            await channel.permissionOverwrites.create(mutedRole, {
                                SendMessages: false,
                                AddReactions: false
                            });
                        } else if (channel.type === ChannelType.GuildVoice) {
                            await channel.permissionOverwrites.create(mutedRole, {
                                Speak: false,
                                Stream: false
                            });
                        }
                    } catch (e) {
                        console.error(`Could not set permissions for ${channel.name}:`, e);
                    }
                }
            }

            // Create confirmation message
            const confirmEmbed = new EmbedBuilder()
                .setTitle("Confirm Mute")
                .setDescription(`Are you sure you want to mute **${targetUser.tag}** (${targetUser.id})?`)
                .addFields({ name: "Reason", value: reason })
                .addFields({ name: "Duration", value: duration ? `Until ${duration.toUTCString()}` : "Permanent" })
                .setColor(Colors.Orange)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("mute_confirm")
                    .setLabel("Confirm")
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji("✅"),
                new ButtonBuilder()
                    .setCustomId("mute_cancel")
                    .setLabel("Cancel")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("❌")
            );

            const confirmMessage = await interaction.editReply({
                embeds: [confirmEmbed],
                components: [confirmRow]
            });

            // Create collector for button interactions
            const collector = confirmMessage.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id && 
                            (i.customId === "mute_confirm" || i.customId === "mute_cancel"),
                time: 30000, // 30 seconds
                max: 1
            });

            collector.on("collect", async i => {
                if (i.customId === "mute_confirm") {
                    try {
                        // Try to DM the muted user
                        try {
                            const dmEmbed = new EmbedBuilder()
                                .setTitle(`You were muted in ${interaction.guild.name}`)
                                .setDescription(`You have been muted in ${interaction.guild.name}`)
                                .addFields({ name: "Reason", value: reason })
                                .addFields({ name: "Duration", value: duration ? `Until ${duration.toUTCString()}` : "Permanent" })
                                .setColor(Colors.Red)
                                .setTimestamp();

                            await targetUser.send({ embeds: [dmEmbed] });
                        } catch (error) {
                            console.log(`Could not DM user ${targetUser.tag}: ${error.message}`);
                        }

                        // Add muted role
                        await targetMember.roles.add(mutedRole, `${reason} | Muted by ${interaction.user.tag}`);
                        
                        // Use Discord's timeout feature if duration is specified and within limits
                        if (duration && durationMs <= 2419200000) { // Max 28 days
                            await targetMember.timeout(durationMs, `${reason} | Muted by ${interaction.user.tag}`);
                        }
                        
                        // Store mute information in database or somewhere if needed
                        // This would be implementation-specific
                        
                        // Create success embed
                        const successEmbed = new EmbedBuilder()
                            .setTitle("User Muted")
                            .setDescription(`Successfully muted **${targetUser.tag}** (${targetUser.id})`)
                            .addFields({ name: "Reason", value: reason })
                            .addFields({ name: "Duration", value: duration ? `Until ${duration.toUTCString()}` : "Permanent" })
                            .addFields({ name: "Muted by", value: `${interaction.user.tag} (${interaction.user.id})` })
                            .setColor(Colors.Green)
                            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                            .setTimestamp();
                            
                        await i.update({
                            embeds: [successEmbed],
                            components: []
                        });
                        
                        // Log the mute if a log channel is set up
                        if (client.config.modLogChannel) {
                            const logChannel = interaction.guild.channels.cache.get(client.config.modLogChannel);
                            if (logChannel) {
                                logChannel.send({ embeds: [successEmbed] }).catch(console.error);
                            }
                        }
                        
                        // If duration is set, create a timeout to unmute the user
                        // If duration is set, create a timeout to unmute the user
                        if (duration) {
                            // Schedule unmute task
                            setTimeout(async () => {
                                try {
                                    const guild = client.guilds.cache.get(interaction.guild.id);
                                    if (!guild) return;
                                    
                                    const member = await guild.members.fetch(targetUser.id).catch(() => null);
                                    if (!member) return;
                                    
                                    // Check if the user still has the muted role
                                    if (member.roles.cache.has(mutedRole.id)) {
                                        await member.roles.remove(mutedRole, "Mute duration expired");
                                        
                                        // Log the automatic unmute
                                        if (client.config.modLogChannel) {
                                            const logChannel = guild.channels.cache.get(client.config.modLogChannel);
                                            if (logChannel) {
                                                const unmutedEmbed = new EmbedBuilder()
                                                    .setTitle("User Automatically Unmuted")
                                                    .setDescription(`**${targetUser.tag}** (${targetUser.id}) has been automatically unmuted after their mute duration expired.`)
                                                    .addFields({ name: "Original Reason", value: reason })
                                                    .addFields({ name: "Muted by", value: `${interaction.user.tag} (${interaction.user.id})` })
                                                    .setColor(Colors.Green)
                                                    .setTimestamp();
                                                
                                                logChannel.send({ embeds: [unmutedEmbed] }).catch(console.error);
                                            }
                                        }
                                    }
                                } catch (error) {
                                    console.error("Error in automatic unmute:", error);
                                }
                            }, durationMs);
                        }
                    } catch (error) {
                        console.error("Error muting user:", error);
                        await i.update({
                            content: `Failed to mute user: ${error.message}`,
                            embeds: [],
                            components: []
                        });
                    }
                } else if (i.customId === "mute_cancel") {
                    const cancelEmbed = new EmbedBuilder()
                        .setTitle("Mute Cancelled")
                        .setDescription(`Mute for **${targetUser.tag}** has been cancelled.`)
                        .setColor(Colors.Blue)
                        .setTimestamp();
                        
                    await i.update({
                        embeds: [cancelEmbed],
                        components: []
                    });
                }
            });

            collector.on("end", async (collected, reason) => {
                if (reason === "time" && collected.size === 0) {
                    const timeoutEmbed = new EmbedBuilder()
                        .setTitle("Mute Cancelled")
                        .setDescription("Mute confirmation timed out.")
                        .setColor(Colors.Blue)
                        .setTimestamp();
                        
                    await interaction.editReply({
                        embeds: [timeoutEmbed],
                        components: []
                    }).catch(console.error);
                }
            });

        } catch (error) {
            console.error("Error in mute command:", error);
            return interaction.editReply({
                content: `An error occurred while trying to mute the user: ${error.message}`
            });
        }
    });

module.exports = command;