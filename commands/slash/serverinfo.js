const SlashCommand = require("../../lib/SlashCommand");
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags } = require("discord.js");

const command = new SlashCommand()
    .setName("serverinfo")
    .setDescription("Shows detailed information about the current server")
    .setRun(async (client, interaction) => {
        const guild = interaction.guild;
        
        // Create main embed
        const createMainEmbed = () => {
            const createdAt = guild.createdAt;
            const createdTimestamp = Math.floor(createdAt.getTime() / 1000);
            
            const verificationLevels = {
                0: '🔓 None',
                1: '🔒 Low',
                2: '🔐 Medium', 
                3: '🔒 High',
                4: '🛡️ Very High'
            };
            
            const boostTiers = {
                0: 'No Boost',
                1: 'Tier 1 🥉',
                2: 'Tier 2 🥈', 
                3: 'Tier 3 🥇'
            };
            
            const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
            const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
            const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
            const totalChannels = textChannels + voiceChannels + categories;
            
            const members = guild.memberCount;
            const bots = guild.members.cache.filter(m => m.user.bot).size;
            const humans = members - bots;
            
            const onlineMembers = guild.members.cache.filter(m => 
                !m.user.bot && m.presence?.status !== 'offline'
            ).size;
            
            const embed = new EmbedBuilder()
                .setTitle(`📊 ${guild.name}`)
                .setDescription(`**Server Information Dashboard**\n\`\`\`Server ID: ${guild.id}\`\`\``)
                .setColor('#5865F2')
                .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
                .addFields([
                    {
                        name: "👑 Owner",
                        value: `<@${guild.ownerId}>\n\`${guild.ownerId}\``,
                        inline: true
                    },
                    {
                        name: "📅 Created",
                        value: `<t:${createdTimestamp}:F>\n<t:${createdTimestamp}:R>`,
                        inline: true
                    },
                    {
                        name: "🛡️ Security",
                        value: `${verificationLevels[guild.verificationLevel]}\n2FA: ${guild.mfaLevel ? '✅' : '❌'}`,
                        inline: true
                    },
                    {
                        name: "👥 Members",
                        value: `**Total:** ${members.toLocaleString()}\n**Humans:** ${humans.toLocaleString()}\n**Bots:** ${bots.toLocaleString()}\n**Online:** ${onlineMembers.toLocaleString()}`,
                        inline: true
                    },
                    {
                        name: "📺 Channels",
                        value: `**Total:** ${totalChannels}\n**Text:** ${textChannels}\n**Voice:** ${voiceChannels}\n**Categories:** ${categories}`,
                        inline: true
                    },
                    {
                        name: "🎭 Server Stats",
                        value: `**Roles:** ${guild.roles.cache.size}\n**Emojis:** ${guild.emojis.cache.size}\n**Stickers:** ${guild.stickers.cache.size}`,
                        inline: true
                    },
                    {
                        name: "💎 Nitro Boost",
                        value: `**Level:** ${boostTiers[guild.premiumTier]}\n**Boosts:** ${guild.premiumSubscriptionCount || 0}\n**Boosters:** ${guild.members.cache.filter(m => m.premiumSince).size}`,
                        inline: true
                    }
                ])
                .setFooter({ 
                    text: `Requested by ${interaction.user.tag} • Page 1/4`, 
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTimestamp();

            if (guild.banner) {
                embed.setImage(guild.bannerURL({ dynamic: true, size: 1024 }));
            }

            return embed;
        };

        // Create channels detailed embed
        const createChannelsEmbed = () => {
            const channels = guild.channels.cache;
            
            const textChannels = channels.filter(c => c.type === ChannelType.GuildText);
            const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice);
            const categories = channels.filter(c => c.type === ChannelType.GuildCategory);
            const newsChannels = channels.filter(c => c.type === ChannelType.GuildAnnouncement);
            const stageChannels = channels.filter(c => c.type === ChannelType.GuildStageVoice);
            const forumChannels = channels.filter(c => c.type === ChannelType.GuildForum);

            const embed = new EmbedBuilder()
                .setTitle(`📺 Channels Overview - ${guild.name}`)
                .setColor('#5865F2')
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .addFields([
                    {
                        name: "💬 Text Channels",
                        value: textChannels.size > 0 ? 
                            `**Count:** ${textChannels.size}\n**Most Active:** ${textChannels.sort((a, b) => b.messages?.cache?.size - a.messages?.cache?.size).first()?.name || 'N/A'}\n**Newest:** ${textChannels.sort((a, b) => b.createdTimestamp - a.createdTimestamp).first()?.name}` :
                            'No text channels',
                        inline: true
                    },
                    {
                        name: "🔊 Voice Channels", 
                        value: voiceChannels.size > 0 ?
                            `**Count:** ${voiceChannels.size}\n**Connected Users:** ${voiceChannels.reduce((acc, c) => acc + c.members.size, 0)}\n**Largest:** ${voiceChannels.sort((a, b) => (b.userLimit || 99) - (a.userLimit || 99)).first()?.name}` :
                            'No voice channels',
                        inline: true
                    },
                    {
                        name: "📁 Categories",
                        value: categories.size > 0 ?
                            `**Count:** ${categories.size}\n**Channels in Categories:** ${categories.reduce((acc, c) => acc + c.children.size, 0)}` :
                            'No categories',
                        inline: true
                    }
                ]);

            if (newsChannels.size > 0) {
                embed.addFields({ name: "📰 News Channels", value: `**Count:** ${newsChannels.size}`, inline: true });
            }
            if (stageChannels.size > 0) {
                embed.addFields({ name: "🎭 Stage Channels", value: `**Count:** ${stageChannels.size}`, inline: true });
            }
            if (forumChannels.size > 0) {
                embed.addFields({ name: "💬 Forum Channels", value: `**Count:** ${forumChannels.size}`, inline: true });
            }

            embed.setFooter({ 
                text: `Requested by ${interaction.user.tag} • Page 2/4`, 
                iconURL: interaction.user.displayAvatarURL() 
            });

            return embed;
        };        // Create roles embed
        const createRolesEmbed = () => {
            const { PermissionFlagsBits } = require("discord.js");
            const roles = guild.roles.cache.sort((a, b) => b.position - a.position);
            const rolesArray = Array.from(roles.values()).filter(r => r.name !== '@everyone');
            const topRoles = rolesArray.slice(0, 10);
            const adminRoles = roles.filter(r => r.permissions.has(PermissionFlagsBits.Administrator)).size;
            
            // Get highest role safely
            const highestRole = rolesArray[0];
            
            // Get role with most members
            const rolesByMembers = rolesArray.sort((a, b) => b.members.size - a.members.size);
            const mostMembersRole = rolesByMembers[0];
            
            const embed = new EmbedBuilder()
                .setTitle(`🎭 Roles Overview - ${guild.name}`)
                .setColor('#5865F2')
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .addFields([
                    {
                        name: "📊 Role Statistics",
                        value: `**Total Roles:** ${roles.size}\n**Admin Roles:** ${adminRoles}\n**Colored Roles:** ${roles.filter(r => r.color !== 0).size}\n**Hoisted Roles:** ${roles.filter(r => r.hoist).size}`,
                        inline: true
                    },
                    {
                        name: "🔝 Highest Role",
                        value: highestRole ? 
                            `${highestRole}\n**Position:** ${highestRole.position}\n**Members:** ${highestRole.members.size}` :
                            'No roles found',
                        inline: true
                    },
                    {
                        name: "👥 Most Members",
                        value: mostMembersRole ? 
                            `${mostMembersRole}\n**Members:** ${mostMembersRole.members.size}` :
                            'No roles with members',
                        inline: true
                    },
                    {
                        name: "🏆 Top Roles (by position)",
                        value: topRoles.length > 0 ? 
                            topRoles.map((r, i) => `**${i + 1}.** ${r} (${r.members.size} members)`).join('\n') : 
                            'No roles',
                        inline: false
                    }
                ])
                .setFooter({ 
                    text: `Requested by ${interaction.user.tag} • Page 3/4`, 
                    iconURL: interaction.user.displayAvatarURL() 
                });

            return embed;
        };

        // Create features embed
        const createFeaturesEmbed = () => {
            const featureNames = {
                'ANIMATED_BANNER': '🎬 Animated Banner',
                'ANIMATED_ICON': '🎭 Animated Icon',
                'BANNER': '🖼️ Server Banner',
                'COMMERCE': '🛒 Commerce',
                'COMMUNITY': '🌍 Community Server',
                'DISCOVERABLE': '🔍 Server Discovery',
                'FEATURABLE': '⭐ Featurable',
                'INVITE_SPLASH': '🌊 Invite Splash',
                'MEMBER_VERIFICATION_GATE_ENABLED': '🛡️ Membership Screening',
                'NEWS': '📰 News Channels',
                'PARTNERED': '🤝 Discord Partner',
                'PREVIEW_ENABLED': '👀 Preview Enabled',
                'VANITY_URL': '🔗 Custom Invite URL',
                'VERIFIED': '✅ Verified Server',
                'VIP_REGIONS': '⚡ VIP Voice Regions',
                'WELCOME_SCREEN_ENABLED': '👋 Welcome Screen',
                'TICKETED_EVENTS_ENABLED': '🎫 Ticketed Events',
                'MONETIZATION_ENABLED': '💰 Monetization',
                'MORE_STICKERS': '😄 More Stickers',
                'THREE_DAY_THREAD_ARCHIVE': '📝 3 Day Thread Archive',
                'SEVEN_DAY_THREAD_ARCHIVE': '📝 7 Day Thread Archive',
                'PRIVATE_THREADS': '🔒 Private Threads'
            };

            const features = guild.features.map(f => featureNames[f] || f).join('\n') || 'No special features';
            
            const embed = new EmbedBuilder()
                .setTitle(`✨ Server Features - ${guild.name}`)
                .setColor('#5865F2')
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .addFields([
                    {
                        name: "🎯 Server Features",
                        value: features.length > 1024 ? features.substring(0, 1021) + '...' : features,
                        inline: false
                    },
                    {
                        name: "📊 Feature Count",
                        value: `**Total Features:** ${guild.features.length}`,
                        inline: true
                    },
                    {
                        name: "🏅 Server Status",
                        value: guild.features.includes('PARTNERED') ? '🤝 **Discord Partner**' :
                               guild.features.includes('VERIFIED') ? '✅ **Verified Server**' :
                               guild.features.includes('COMMUNITY') ? '🌍 **Community Server**' :
                               '📋 **Regular Server**',
                        inline: true
                    }
                ])
                .setFooter({ 
                    text: `Requested by ${interaction.user.tag} • Page 4/4`, 
                    iconURL: interaction.user.displayAvatarURL() 
                });

            if (guild.features.includes('BANNER') && guild.banner) {
                embed.setImage(guild.bannerURL({ dynamic: true, size: 1024 }));
            }

            return embed;
        };

        // Create select menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('serverinfo_select')
            .setPlaceholder('📋 Choose information category')
            .addOptions([
                {
                    label: 'General Info',
                    description: 'Basic server information and statistics',
                    value: 'general',
                    emoji: '📊'
                },
                {
                    label: 'Channels',
                    description: 'Detailed channel information',
                    value: 'channels', 
                    emoji: '📺'
                },
                {
                    label: 'Roles',
                    description: 'Server roles and permissions',
                    value: 'roles',
                    emoji: '🎭'
                },
                {
                    label: 'Features',
                    description: 'Server features and capabilities',
                    value: 'features',
                    emoji: '✨'
                }
            ]);

        // Create action buttons
        const actionButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('refresh_serverinfo')
                    .setLabel('🔄 Refresh')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('server_icon')
                    .setLabel('🖼️ Server Icon')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('server_banner')
                    .setLabel('🎨 Server Banner')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(!guild.banner),
                new ButtonBuilder()
                    .setCustomId('invite_info')
                    .setLabel('🔗 Invite Info')
                    .setStyle(ButtonStyle.Success)
            );

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            embeds: [createMainEmbed()],
            components: [selectRow, actionButtons],
            ephemeral: false
        });

        // Create collector for interactions
        const filter = (i) => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({
            filter,
            time: 300000 // 5 minutes
        });

        collector.on('collect', async (i) => {
            try {
                if (i.customId === 'serverinfo_select') {
                    let embed;
                    switch (i.values[0]) {
                        case 'general':
                            embed = createMainEmbed();
                            break;
                        case 'channels':
                            embed = createChannelsEmbed();
                            break;
                        case 'roles':
                            embed = createRolesEmbed();
                            break;
                        case 'features':
                            embed = createFeaturesEmbed();
                            break;
                    }
                    await i.update({ embeds: [embed] });
                } else if (i.customId === 'refresh_serverinfo') {
                    await i.update({ embeds: [createMainEmbed()] });
                } else if (i.customId === 'server_icon') {
                    const iconEmbed = new EmbedBuilder()
                        .setTitle(`🖼️ ${guild.name} - Server Icon`)
                        .setColor('#5865F2')
                        .setImage(guild.iconURL({ dynamic: true, size: 1024 }))
                        .setFooter({ text: `Requested by ${i.user.tag}` });
                    await i.reply({ embeds: [iconEmbed], flags: MessageFlags.Ephemeral });
                } else if (i.customId === 'server_banner') {
                    if (guild.banner) {
                        const bannerEmbed = new EmbedBuilder()
                            .setTitle(`🎨 ${guild.name} - Server Banner`)
                            .setColor('#5865F2')
                            .setImage(guild.bannerURL({ dynamic: true, size: 1024 }))
                            .setFooter({ text: `Requested by ${i.user.tag}` });
                        await i.reply({ embeds: [bannerEmbed], flags: MessageFlags.Ephemeral });
                    }
                } else if (i.customId === 'invite_info') {
                    const invites = await guild.invites.fetch();
                    const inviteEmbed = new EmbedBuilder()
                        .setTitle(`🔗 ${guild.name} - Invite Information`)
                        .setColor('#5865F2')
                        .addFields({ name: 'Total Invites', value: invites.size.toString(), inline: true })
                        .addFields({ name: 'Vanity URL', value: guild.vanityURLCode ? `discord.gg/${guild.vanityURLCode}` : 'None', inline: true })
                        .setFooter({ text: `Requested by ${i.user.tag}` });
                    await i.reply({ embeds: [inviteEmbed], flags: MessageFlags.Ephemeral });
                }
            } catch (error) {
                console.error('Error handling interaction:', error);
                if (!i.replied && !i.deferred) {
                    await i.reply({ content: '❌ An error occurred while processing your request.', flags: MessageFlags.Ephemeral });
                }
            }
        });

        collector.on('end', () => {
            // Disable all components when collector ends
            const disabledSelectRow = new ActionRowBuilder()
                .addComponents(
                    selectMenu.setDisabled(true)
                );
            const disabledButtonRow = new ActionRowBuilder()
                .addComponents(
                    ...actionButtons.components.map(button => button.setDisabled(true))
                );
            
            interaction.editReply({
                components: [disabledSelectRow, disabledButtonRow]
            }).catch(() => {});
        });
    });

module.exports = command;