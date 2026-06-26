const SlashCommand = require("../../lib/SlashCommand");
const { 
    EmbedBuilder, 
    PermissionFlagsBits,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    Colors,
    ChannelType,
    MessageFlags
} = require("discord.js");

const command = new SlashCommand()
    .setName("logconfig")
    .setDescription("Configure server logs")
    .addSubcommand(subcommand =>
        subcommand
            .setName("view")
            .setDescription("View current log settings")
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("set")
            .setDescription("Set a log channel")
            .addStringOption(option =>
                option
                    .setName("type")
                    .setDescription("Type of logs to set channel for")
                    .setRequired(true)
                    .addChoices(
                        { name: "All Logs", value: "ALL" },
                        { name: "Moderation Logs", value: "MOD" },
                        { name: "Server Logs", value: "SERVER" },
                        { name: "Member Logs", value: "MEMBER" },
                        { name: "Message Logs", value: "MESSAGE" },
                        { name: "Voice Logs", value: "VOICE" },
                        { name: "Profile Logs", value: "PROFILE" },
                        { name: "Role Logs", value: "ROLE" }
                    )
            )
            .addChannelOption(option =>
                option
                    .setName("channel")
                    .setDescription("Channel to send logs to")
                    .setRequired(true)
            )
    )
    .setRun(async (client, interaction) => {
        // Verificar permissões
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: "You need the Manage Server permission to configure logs.",
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        
        // Obter configurações atuais
        const logSettings = await client.logManager.getGuildLogSettings(guildId);
        
        if (!logSettings) {
            return interaction.editReply("Failed to load log settings. Please try again later.");
        }
        
        switch (subcommand) {
            case "view":
                await handleViewSettings(interaction, logSettings);
                break;
                
            case "set":
                await handleSetChannel(interaction, logSettings);
                break;
        }
    });

// Handler para visualizar configurações
async function handleViewSettings(interaction, logSettings) {
    const { guild, client } = interaction;
    
    // Criar embed com as configurações atuais
    const embed = new EmbedBuilder()
        .setTitle("Log Settings")
        .setColor(interaction.client.config.embedColor)
        .setDescription("Current log configuration for this server")
        .setTimestamp();
    
    // Adicionar canais configurados
    const modLogChannel = logSettings.modLogChannel ? 
        guild.channels.cache.get(logSettings.modLogChannel) : null;
    
    const serverLogChannel = logSettings.serverLogChannel ? 
        guild.channels.cache.get(logSettings.serverLogChannel) : null;
    
    const memberLogChannel = logSettings.memberLogChannel ? 
        guild.channels.cache.get(logSettings.memberLogChannel) : null;
    
    const messageLogChannel = logSettings.messageLogChannel ? 
        guild.channels.cache.get(logSettings.messageLogChannel) : null;
    
    const voiceLogChannel = logSettings.voiceLogChannel ? 
        guild.channels.cache.get(logSettings.voiceLogChannel) : null;
    
    const profileLogChannel = logSettings.profileLogChannel ? 
        guild.channels.cache.get(logSettings.profileLogChannel) : null;
    
    const roleLogChannel = logSettings.roleLogChannel ? 
        guild.channels.cache.get(logSettings.roleLogChannel) : null;
    
    embed.addFields({ 
        name: "Moderation Logs", 
        value: modLogChannel ? 
            `${modLogChannel} (${logSettings.enabledLogs.includes('MOD') ? 'Enabled' : 'Disabled'})` : 
            "Not set",
        inline: true
    });
    
    embed.addFields({ 
        name: "Server Logs", 
        value: serverLogChannel ? 
            `${serverLogChannel} (${logSettings.enabledLogs.includes('SERVER') ? 'Enabled' : 'Disabled'})` : 
            "Not set",
        inline: true
    });
    
    embed.addFields({ 
        name: "Member Logs", 
        value: memberLogChannel ? 
            `${memberLogChannel} (${logSettings.enabledLogs.includes('MEMBER') ? 'Enabled' : 'Disabled'})` : 
            "Not set",
        inline: true
    });
    
    embed.addFields({ 
        name: "Message Logs", 
        value: messageLogChannel ? 
            `${messageLogChannel} (${logSettings.enabledLogs.includes('MESSAGE') ? 'Enabled' : 'Disabled'})` : 
            "Not set",
        inline: true
    });
    
    embed.addFields({ 
        name: "Voice Logs", 
        value: voiceLogChannel ? 
            `${voiceLogChannel} (${logSettings.enabledLogs.includes('VOICE') ? 'Enabled' : 'Disabled'})` : 
            "Not set",
        inline: true
    });
    
    embed.addFields({ 
        name: "Profile Logs", 
        value: profileLogChannel ? 
            `${profileLogChannel} (${logSettings.enabledLogs.includes('PROFILE') ? 'Enabled' : 'Disabled'})` : 
            "Not set",
        inline: true
    });
    
    embed.addFields({ 
        name: "Role Logs", 
        value: roleLogChannel ? 
            `${roleLogChannel} (${logSettings.enabledLogs.includes('ROLE') ? 'Enabled' : 'Disabled'})` : 
            "Not set",
        inline: true
    });
    
    // Adicionar informações sobre como configurar
    embed.addFields({ 
        name: "\u200B", 
        value: "Use `/logconfig set` to set a log channel\n" +
        "Use the buttons below to enable/disable log types"
    });
    
    // Criar botões para ativar/desativar cada tipo de log
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`logs:toggle:MOD:${guild.id}`)
            .setLabel(`${logSettings.enabledLogs.includes('MOD') ? 'Disable' : 'Enable'} Moderation Logs`)
            .setStyle(logSettings.enabledLogs.includes('MOD') ? ButtonStyle.Danger : ButtonStyle.Success)
            .setDisabled(!modLogChannel),
        
        new ButtonBuilder()
            .setCustomId(`logs:toggle:SERVER:${guild.id}`)
            .setLabel(`${logSettings.enabledLogs.includes('SERVER') ? 'Disable' : 'Enable'} Server Logs`)
            .setStyle(logSettings.enabledLogs.includes('SERVER') ? ButtonStyle.Danger : ButtonStyle.Success)
            .setDisabled(!serverLogChannel)
    );
    
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`logs:toggle:MEMBER:${guild.id}`)
            .setLabel(`${logSettings.enabledLogs.includes('MEMBER') ? 'Disable' : 'Enable'} Member Logs`)
            .setStyle(logSettings.enabledLogs.includes('MEMBER') ? ButtonStyle.Danger : ButtonStyle.Success)
            .setDisabled(!memberLogChannel),
        
        new ButtonBuilder()
            .setCustomId(`logs:toggle:MESSAGE:${guild.id}`)
            .setLabel(`${logSettings.enabledLogs.includes('MESSAGE') ? 'Disable' : 'Enable'} Message Logs`)
            .setStyle(logSettings.enabledLogs.includes('MESSAGE') ? ButtonStyle.Danger : ButtonStyle.Success)
            .setDisabled(!messageLogChannel)
    );
    
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`logs:toggle:VOICE:${guild.id}`)
            .setLabel(`${logSettings.enabledLogs.includes('VOICE') ? 'Disable' : 'Enable'} Voice Logs`)
            .setStyle(logSettings.enabledLogs.includes('VOICE') ? ButtonStyle.Danger : ButtonStyle.Success)
            .setDisabled(!voiceLogChannel),
            
        new ButtonBuilder()
            .setCustomId(`logs:toggle:PROFILE:${guild.id}`)
            .setLabel(`${logSettings.enabledLogs.includes('PROFILE') ? 'Disable' : 'Enable'} Profile Logs`)
            .setStyle(logSettings.enabledLogs.includes('PROFILE') ? ButtonStyle.Danger : ButtonStyle.Success)
            .setDisabled(!profileLogChannel)
    );
    
    const row4 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`logs:toggle:ROLE:${guild.id}`)
            .setLabel(`${logSettings.enabledLogs.includes('ROLE') ? 'Disable' : 'Enable'} Role Logs`)
            .setStyle(logSettings.enabledLogs.includes('ROLE') ? ButtonStyle.Danger : ButtonStyle.Success)
            .setDisabled(!roleLogChannel)
    );
    
    const message = await interaction.editReply({ 
        embeds: [embed],
        components: [row1, row2, row3, row4] 
    });
    
    // Criar coletor para botões
    const collector = message.createMessageComponentCollector({ 
        filter: i => i.user.id === interaction.user.id && i.customId.startsWith('logs:toggle:'),
        time: 300000 // 5 minutos
    });
    
    collector.on('collect', async i => {
        await i.deferUpdate();
        
        const [, , logType, guildId] = i.customId.split(':');
        
        // Obter configurações atualizadas
        const updatedSettings = await client.logManager.getGuildLogSettings(guildId);
        
        // Alternar estado
        if (updatedSettings.enabledLogs.includes(logType)) {
            // Desabilitar
            updatedSettings.enabledLogs = updatedSettings.enabledLogs.filter(type => type !== logType);
        } else {
            // Habilitar
            updatedSettings.enabledLogs.push(logType);
        }
        
        // Salvar configurações
        await client.logManager.updateGuildLogSettings(guildId, updatedSettings);
        
        // Atualizar embed e botões
        await handleViewSettings(interaction, updatedSettings);
    });
}

// Handler para definir canal de log
async function handleSetChannel(interaction, logSettings) {
    const logType = interaction.options.getString("type");
    const channel = interaction.options.getChannel("channel");
    
    // Verificar se o canal é um canal de texto
    if (channel.type !== ChannelType.GuildText) {
        return interaction.editReply("The log channel must be a text channel.");
    }
    
    // Verificar permissões no canal
    const botMember = interaction.guild.members.me;
    if (!channel.permissionsFor(botMember).has([
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks
    ])) {
        return interaction.editReply(`I don't have permission to send messages or embeds in ${channel}. Please adjust my permissions.`);
    }
    
    // Caso especial para "ALL" - configurar todos os tipos de log
    if (logType === "ALL") {
        logSettings.modLogChannel = channel.id;
        logSettings.serverLogChannel = channel.id;
        logSettings.memberLogChannel = channel.id;
        logSettings.messageLogChannel = channel.id;
        logSettings.voiceLogChannel = channel.id;
        logSettings.profileLogChannel = channel.id;
        logSettings.roleLogChannel = channel.id;
        
        // Habilitar todos os tipos de log
        const allLogTypes = ['MOD', 'SERVER', 'MEMBER', 'MESSAGE', 'VOICE', 'PROFILE', 'ROLE'];
        allLogTypes.forEach(type => {
            if (!logSettings.enabledLogs.includes(type)) {
                logSettings.enabledLogs.push(type);
            }
        });
    } else {
        // Atualizar configuração para um tipo específico
    switch (logType) {
        case "MOD":
            logSettings.modLogChannel = channel.id;
            break;
        case "SERVER":
            logSettings.serverLogChannel = channel.id;
            break;
        case "MEMBER":
            logSettings.memberLogChannel = channel.id;
            break;
        case "MESSAGE":
            logSettings.messageLogChannel = channel.id;
            break;
        case "VOICE":
            logSettings.voiceLogChannel = channel.id;
            break;
        case "PROFILE":
            logSettings.profileLogChannel = channel.id;
            break;
        case "ROLE":
            logSettings.roleLogChannel = channel.id;
            break;
    }
    
    // Garantir que o tipo de log está habilitado
    if (!logSettings.enabledLogs.includes(logType)) {
        logSettings.enabledLogs.push(logType);
        }
    }
    
    // Salvar configurações
    const success = await interaction.client.logManager.updateGuildLogSettings(
        interaction.guild.id, 
        logSettings
    );
    
    if (success) {
        // Enviar mensagem de teste
        const testEmbed = new EmbedBuilder()
            .setTitle("Log Channel Test")
            .setColor("#00FF00")
            .setDescription(
                logType === "ALL" 
                ? `This channel has been set as the central log channel for all log types.` 
                : `This channel has been set as the ${getLogTypeName(logType)} channel.`
            )
            .addFields({ name: "Configured by", value: interaction.user.tag })
            .setTimestamp();
            
        await channel.send({ embeds: [testEmbed] }).catch(() => {});
        
        await interaction.editReply(
            logType === "ALL"
            ? `Successfully set ${channel} as the channel for all log types.`
            : `Successfully set ${channel} as the ${getLogTypeName(logType)} channel.`
        );
    } else {
        await interaction.editReply("Failed to update log settings. Please try again later.");
    }
}

// Função auxiliar para obter nome amigável do tipo de log
function getLogTypeName(logType) {
    switch (logType) {
        case "MOD":
            return "Moderation Logs";
        case "SERVER":
            return "Server Logs";
        case "MEMBER":
            return "Member Logs";
        case "MESSAGE":
            return "Message Logs";
        case "VOICE":
            return "Voice Logs";
        case "PROFILE":
            return "Profile Logs";
        case "ROLE":
            return "Role Logs";
        default:
            return "Unknown Logs";
    }
}

module.exports = command;