const SlashCommand = require("../../lib/SlashCommand");
const {EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  Colors,
  ChannelType,
  ModalBuilder, 
  TextInputBuilder,
  TextInputStyle,
  MessageFlags} = require("discord.js");
const fs = require("fs");
const path = require("path");

// Funções de banco de dados (sem alterações)
function getDBPath() {
    return path.join(process.cwd(), "db.json");
}

function loadDB() {
    try {
        const dbPath = getDBPath();
        if (!fs.existsSync(dbPath)) {
            return { tickets: {} };
        }
        const data = fs.readFileSync(dbPath, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Error loading database:", error);
        return { tickets: {} };
    }
}

function saveDB(db) {
    try {
        const dbPath = getDBPath();
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("Error saving database:", error);
        return false;
    }
}

function getGuildTickets(guildId) {
    const db = loadDB();
    if (!db.tickets) db.tickets = {};
    if (!db.tickets[guildId]) db.tickets[guildId] = {
        enabled: false,
        categoryId: null,
        logChannelId: null,
        supportRoleIds: [],
        ticketTypes: [
            { id: "support", name: "General Support", emoji: "🔧", description: "Get general help with the server" },
            { id: "report", name: "Report User", emoji: "🚨", description: "Report a user who broke the rules" }
        ],
        welcomeMessage: "Thank you for opening a ticket! Our support team will attend to you shortly.",
        activeTickets: {},
        ticketCounter: 0
    };
    return db.tickets[guildId];
}

function saveGuildTickets(guildId, ticketData) {
    const db = loadDB();
    if (!db.tickets) db.tickets = {};
    db.tickets[guildId] = ticketData;
    return saveDB(db);
}

const command = new SlashCommand()
    .setName("ticket")
    .setDescription("Support ticket system")
    .addSubcommand(subcommand =>
        subcommand
            .setName("setup")
            .setDescription("Configure the ticket system")
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("panel")
            .setDescription("Create a panel for opening tickets")
            .addChannelOption(option =>
                option
                    .setName("channel")
                    .setDescription("Channel where the panel will be sent")
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("add")
            .setDescription("Add a user to the current ticket")
            .addUserOption(option =>
                option
                    .setName("user")
                    .setDescription("User to add to the ticket")
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("remove")
            .setDescription("Remove a user from the current ticket")
            .addUserOption(option =>
                option
                    .setName("user")
                    .setDescription("User to remove from the ticket")
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("close")
            .setDescription("Close the current ticket")
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("settings")
            .setDescription("Manage ticket system settings")
    )
    .setRun(async (client, interaction) => {
        // Configure ticket system events (only once)
        if (!client.ticketEventsSetup) {
            setupTicketEvents(client);
            client.ticketEventsSetup = true;
        }
        
        const subcommand = interaction.options.getSubcommand();
        
        // Load server ticket settings
        const guildId = interaction.guild.id;
        const ticketData = getGuildTickets(guildId);
        
        switch (subcommand) {
            case "setup":
                // Verifica permissões de administrador
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({
                        content: "You need Administrator permission to configure the ticket system.",
                        flags: MessageFlags.Ephemeral
                    });
                }
                await handleTicketSetup(interaction, ticketData);
                break;
                
            case "panel":
                // Verifica permissões de administrador
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({
                        content: "You need Administrator permission to create ticket panels.",
                        flags: MessageFlags.Ephemeral
                    });
                }
                await handleTicketPanel(interaction, ticketData);
                break;
                
                case "add":
                    // Adicionar usuário ao ticket
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    
                    // Verifica se o canal atual é um ticket
                    if (!interaction.channel.name.startsWith("ticket-")) {
                        return interaction.editReply("❌ This command can only be used in a ticket channel.");
                    }
                    
                    // Extrai o ID do ticket do nome do canal
                    const addTicketId = interaction.channel.name.split("-")[1];
                    
                    // Verifica se o ticket existe nos registros
                    const isAddTicket = ticketData.activeTickets && ticketData.activeTickets[addTicketId];
                    if (!isAddTicket) {
                        return interaction.editReply("❌ This channel appears to be a ticket, but is not registered in the system. It may be an old channel or created manually.");
                    }
                    
                    // Verifica se o usuário que executou o comando tem permissão
                    const hasAddPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                                        (ticketData.supportRoleIds && ticketData.supportRoleIds.some(roleId => interaction.member.roles.cache.has(roleId)));
                    
                    if (!hasAddPermission) {
                        return interaction.editReply("❌ You don't have permission to add users to this ticket.");
                    }
                    
                    // Obtém o usuário a ser adicionado
                    const userToAdd = interaction.options.getUser("user");
                    
                    // Verifica se o usuário é um bot
                    if (userToAdd.bot) {
                        return interaction.editReply("❌ It's not possible to add bots to the ticket.");
                    }
                    
                    try {
                        // Obtém o membro do servidor
                        const memberToAdd = await interaction.guild.members.fetch(userToAdd.id).catch(() => null);
                        
                        if (!memberToAdd) {
                            return interaction.editReply("❌ Could not find this user on the server.");
                        }
                        
                        // Verifica se o usuário já tem acesso ao canal
                        if (interaction.channel.permissionsFor(memberToAdd).has(PermissionFlagsBits.ViewChannel)) {
                            return interaction.editReply("❌ This user already has access to the ticket.");
                        }
                        
                        // Adiciona o usuário ao canal
                        await interaction.channel.permissionOverwrites.edit(memberToAdd, {
                            ViewChannel: true,
                            SendMessages: true,
                            ReadMessageHistory: true
                        });
                        
                        // Notifica sobre a adição
                        const addEmbed = new EmbedBuilder()
                            .setColor(interaction.client.config.embedColor)
                            .setDescription(`${userToAdd} was added to the ticket by ${interaction.user}`)
                            .setTimestamp();
                        
                        await interaction.channel.send({ embeds: [addEmbed] });
                        
                        await interaction.editReply(`✅ ${userToAdd} was successfully added to the ticket.`);
                    } catch (error) {
                        console.error("Error adding user to ticket:", error);
                        await interaction.editReply(`❌ An error occurred while adding the user: ${error.message}`);
                    }
                    break;
                    
                case "remove":
                    // Remover usuário do ticket
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    
                    // Verifica se o canal atual é um ticket
                    if (!interaction.channel.name.startsWith("ticket-")) {
                        return interaction.editReply("❌ This command can only be used in a ticket channel.");
                    }
                    
                    // Extrai o ID do ticket do nome do canal
                    const removeTicketId = interaction.channel.name.split("-")[1];
                    
                    // Verifica se o ticket existe nos registros
                    const isRemoveTicket = ticketData.activeTickets && ticketData.activeTickets[removeTicketId];
                    if (!isRemoveTicket) {
                        return interaction.editReply("❌ This channel appears to be a ticket, but is not registered in the system. It may be an old channel or created manually.");
                    }
                    
                    // Verifica se o usuário que executou o comando tem permissão
                    const hasRemovePermission = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                                        (ticketData.supportRoleIds && ticketData.supportRoleIds.some(roleId => interaction.member.roles.cache.has(roleId)));
                    
                    if (!hasRemovePermission) {
                        return interaction.editReply("❌ You don't have permission to remove users from this ticket.");
                    }
                    
                    // Obtém o usuário a ser removido
                    const userToRemove = interaction.options.getUser("user");
                    
                    // Verifica se o usuário é o criador do ticket
                    if (userToRemove.id === ticketData.activeTickets[removeTicketId].creatorId) {
                        return interaction.editReply("❌ You cannot remove the ticket creator.");
                    }
                    
                    try {
                        // Obtém o membro do servidor
                        const memberToRemove = await interaction.guild.members.fetch(userToRemove.id).catch(() => null);
                        
                        if (!memberToRemove) {
                            return interaction.editReply("❌ Could not find this user on the server.");
                        }
                        
                        // Verifica se o usuário é um administrador ou moderador
                        if (memberToRemove.permissions.has(PermissionFlagsBits.Administrator) && 
                            !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                            return interaction.editReply("❌ You don't have permission to remove an administrator from the ticket.");
                        }
                        
                        // Verifica se o usuário é da equipe de suporte
                        if (ticketData.supportRoleIds && ticketData.supportRoleIds.some(roleId => memberToRemove.roles.cache.has(roleId)) &&
                            !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                            return interaction.editReply("❌ You don't have permission to remove a support team member from the ticket.");
                        }
                        
                        // Remove o usuário do canal
                        await interaction.channel.permissionOverwrites.delete(memberToRemove);
                        
                        // Notifica sobre a remoção
                        const removeEmbed = new EmbedBuilder()
                            .setColor(interaction.client.config.embedColor)
                            .setDescription(`${userToRemove} was removed from the ticket by ${interaction.user}`)
                            .setTimestamp();
                        
                        await interaction.channel.send({ embeds: [removeEmbed] });
                        
                        await interaction.editReply(`✅ ${userToRemove} was successfully removed from the ticket.`);
                    } catch (error) {
                        console.error("Error removing user from ticket:", error);
                        await interaction.editReply(`❌ An error occurred while removing the user: ${error.message}`);
                    }
                    break;
                    
                case "close":
                    // Fechar ticket
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    
                    // Verifica se o canal atual é um ticket
                    if (!interaction.channel.name.startsWith("ticket-")) {
                        return interaction.editReply("❌ This command can only be used in a ticket channel.");
                    }
                    
                    // Extrai o ID do ticket do nome do canal
                    const closeTicketId = interaction.channel.name.split("-")[1];
                    
                    // Verifica se o ticket existe nos registros
                    const isCloseTicket = ticketData.activeTickets && ticketData.activeTickets[closeTicketId];
                    if (!isCloseTicket) {
                        return interaction.editReply("❌ This channel appears to be a ticket, but is not registered in the system. It may be an old channel or created manually.");
                    }
                    
                    // Verifica se o usuário que executou o comando tem permissão
                    const hasClosePermission = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                                        (ticketData.supportRoleIds && ticketData.supportRoleIds.some(roleId => interaction.member.roles.cache.has(roleId))) ||
                                        interaction.user.id === ticketData.activeTickets[closeTicketId].creatorId;
                    
                    if (!hasClosePermission) {
                        return interaction.editReply("❌ You don't have permission to close this ticket.");
                    }
                    
                    // Confirma o fechamento do ticket
                    const confirmRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("ticket_close_confirm")
                            .setLabel("Confirm Closure")
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji("✅"),
                        new ButtonBuilder()
                            .setCustomId("ticket_close_cancel")
                            .setLabel("Cancel")
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji("❌")
                    );
                    
                    // Envia mensagem de confirmação
                    const closeConfirmMsg = await interaction.editReply({
                        content: "Are you sure you want to close this ticket?",
                        components: [confirmRow]
                    });
                    
                    // Coletor para os botões de confirmação
                    const confirmCollector = closeConfirmMsg.createMessageComponentCollector({
                        filter: i => i.user.id === interaction.user.id,
                        time: 30000, // 30 segundos
                        max: 1
                    });
                    
                    confirmCollector.on("collect", async i => {
                        if (i.customId === "ticket_close_confirm") {
                            await i.deferUpdate();
                            
                            // Notifica o canal que o ticket será fechado
                            const closeEmbed = new EmbedBuilder()
                                .setColor("#FF0000")
                                .setTitle("Ticket Closed")
                                .setDescription(`This ticket was closed by ${interaction.user}`)
                                .setTimestamp();
                            
                            await interaction.channel.send({ embeds: [closeEmbed] });
                            
                            // Registra no log se o canal estiver configurado
                            if (ticketData.logChannelId) {
                                const logChannel = interaction.guild.channels.cache.get(ticketData.logChannelId);
                                
                                if (logChannel) {
                                    const ticketInfo = ticketData.activeTickets[closeTicketId];
                                    const ticketType = ticketData.ticketTypes.find(t => t.id === ticketInfo.type) || { name: "Unknown" };
                                    
                                    const logEmbed = new EmbedBuilder()
                                        .setColor("#FF0000")
                                        .setTitle(`Ticket #${closeTicketId} Closed`)
                                        .setDescription(`Ticket closed by ${interaction.user}`)
                                        .addFields(
                                            { name: "Ticket ID", value: closeTicketId, inline: true },
                                            { name: "Type", value: ticketType.name, inline: true },
                                            { name: "Created by", value: `<@${ticketInfo.creatorId}>`, inline: true },
                                            { name: "Closed by", value: `${interaction.user}`, inline: true },
                                            { name: "Created at", value: `<t:${Math.floor(ticketInfo.createdAt / 1000)}:F>`, inline: true },
                                            { name: "Closed at", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                                        )
                                        .setTimestamp();
                                    
                                    await logChannel.send({ embeds: [logEmbed] }).catch(console.error);
                                }
                            }
                            
                            // Remove o ticket dos registros
                            delete ticketData.activeTickets[closeTicketId];
                            saveGuildTickets(interaction.guild.id, ticketData);
                            
                            // Espera 5 segundos e então deleta o canal
                            await i.editReply("✅ This ticket will be deleted in 5 seconds...");
                            
                            setTimeout(async () => {
                                try {
                                    await interaction.channel.delete(`Ticket #${closeTicketId} closed by ${interaction.user.tag}`);
                                } catch (error) {
                                    console.error("Error deleting ticket channel:", error);
                                }
                            }, 5000);
                        } else {
                            await i.update({
                                content: "❌ Ticket closure cancelled.",
                                components: []
                            });
                        }
                    });
                    
                    confirmCollector.on("end", async (collected, reason) => {
                        if (reason === "time" && collected.size === 0) {
                            await interaction.editReply({
                                content: "⏱️ Time expired. The ticket was not closed.",
                                components: []
                            }).catch(console.error);
                        }
                    });
                    break;
                
            case "settings":
                // Verifica permissões de administrador
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({
                        content: "You need Administrator permission to manage ticket system settings.",
                        flags: MessageFlags.Ephemeral
                    });
                }
                
                await handleTicketSettings(interaction, ticketData);
                break;
        }
    });

// Handler para configurar o sistema de tickets
async function handleTicketSetup(interaction, ticketData) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    // Função para criar o embed de configuração
    function createSetupEmbed() {
        const embed = new EmbedBuilder()
            .setTitle("🎫 Ticket System Configuration")
            .setColor(interaction.client.config.embedColor)
            .setDescription("Configure the ticket system for your server. Select the options below to customize the system.")
            .addFields({ name: "System Status", value: ticketData.enabled ? "✅ Enabled" : "❌ Disabled" });
        
        // Categoria para tickets
        const category = interaction.guild.channels.cache.get(ticketData.categoryId);
        embed.addFields({ name: "Ticket Category", value: category ? `📁 ${category.name}` : "❌ Not configured" });
        
        // Canal de logs
        const logChannel = interaction.guild.channels.cache.get(ticketData.logChannelId);
        embed.addFields({ name: "Log Channel", value: logChannel ? `📋 ${logChannel.name}` : "❌ Not configured" });
        
        // Cargos de suporte
        const supportRoles = ticketData.supportRoleIds.map(id => {
            const role = interaction.guild.roles.cache.get(id);
            return role ? `<@&${id}>` : `Unknown role (${id})`;
        });
        embed.addFields({ name: "Support Roles", value: supportRoles.length > 0 ? supportRoles.join(", ") : "❌ No roles configured" });
        
        // Tipos de tickets
        const ticketTypes = ticketData.ticketTypes.map(type => `${type.emoji} ${type.name}`);
        embed.addFields({ name: "Ticket Types", value: ticketTypes.length > 0 ? ticketTypes.join("\n") : "❌ No types configured" });
        
        return embed;
    }
    
    // Botões para as diferentes configurações
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_toggle")
            .setLabel(ticketData.enabled ? "Disable System" : "Enable System")
            .setStyle(ticketData.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
            .setEmoji(ticketData.enabled ? "🔴" : "🟢"),
        new ButtonBuilder()
            .setCustomId("ticket_category")
            .setLabel("Set Category")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("📁")
    );
    
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_log")
            .setLabel("Log Channel")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("📋"),
        new ButtonBuilder()
            .setCustomId("ticket_roles")
            .setLabel("Support Roles")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("👥")
    );
    
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_types")
            .setLabel("Ticket Types")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("🏷️"),
        new ButtonBuilder()
            .setCustomId("ticket_welcome")
            .setLabel("Welcome Message")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("💬")
    );
    
    // Envia a mensagem de configuração
    const message = await interaction.editReply({
        embeds: [createSetupEmbed()],
        components: [row1, row2, row3]
    });
    
    // Cria um coletor para as interações com os botões
    const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 600000 // 10 minutos
    });
    
    // Coletor de mensagens para entrada de texto
    const messageCollector = interaction.channel.createMessageCollector({
        filter: m => m.author.id === interaction.user.id,
        time: 600000 // 10 minutos
    });
    
    // Estado atual do configurador
    let configState = {
        waitingForMessage: false,
        configType: null
    };
    
    // Processa as interações com os botões
    collector.on("collect", async i => {
        await i.deferUpdate().catch(console.error);
        
        switch (i.customId) {
            case "ticket_toggle":
                // Alterna o estado do sistema
                ticketData.enabled = !ticketData.enabled;
                saveGuildTickets(interaction.guild.id, ticketData);
                
                // Atualiza os botões
                row1.components[0]
                    .setLabel(ticketData.enabled ? "Disable System" : "Enable System")
                    .setStyle(ticketData.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(ticketData.enabled ? "🔴" : "🟢");
                
                await i.editReply({
                    embeds: [createSetupEmbed()],
                    components: [row1, row2, row3]
                });
                
                await i.followUp({
                    content: ticketData.enabled ? "✅ Ticket system enabled!" : "🔴 Ticket system disabled!",
                    flags: MessageFlags.Ephemeral
                });
                break;
                
            case "ticket_category":
                // Obter categorias do servidor
                const categories = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
                
                if (categories.size === 0) {
                    return i.followUp({
                        content: "I couldn't find any categories on the server. Please create a category first.",
                        flags: MessageFlags.Ephemeral
                    });
                }
                
                // Prepara opções para o menu de seleção
                const categoryOptions = [];
                
                // Adiciona opção para criar nova categoria
                categoryOptions.push({
                    label: "✨ Create New Category",
                    description: "Creates a new category for tickets",
                    value: "new_category"
                });
                
                // Adiciona opção para remover categoria (se existir uma configurada)
                if (ticketData.categoryId) {
                    categoryOptions.push({
                        label: "❌ Remove Current Category",
                        description: "Removes the currently set category",
                        value: "remove_category"
                    });
                }
                
                // Adiciona todas as categorias existentes
                categories.forEach(category => {
                    categoryOptions.push({
                        label: category.name,
                        description: `ID: ${category.id}`,
                        value: category.id
                    });
                });
                
                // Cria o menu de seleção
                const categoryRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("ticket_category_select")
                        .setPlaceholder("Select a category")
                        .addOptions(categoryOptions)
                );
                
                // Envia o menu
                const categoryMsg = await i.followUp({
                    content: "Select the category where ticket channels will be created:",
                    components: [categoryRow],
                    flags: MessageFlags.Ephemeral
                });
                
                // Coletor para o menu
                const categoryCollector = categoryMsg.createMessageComponentCollector({
                    filter: i => i.user.id === interaction.user.id && i.customId === "ticket_category_select",
                    time: 60000, // 1 minuto
                    max: 1
                });
                
                categoryCollector.on("collect", async i => {
                    await i.deferUpdate();
                    
                    if (i.values[0] === "remove_category") {
                        // Remove a categoria atual
                        ticketData.categoryId = null;
                        saveGuildTickets(interaction.guild.id, ticketData);
                        
                        await i.editReply({
                            content: "✅ Ticket category removed successfully!",
                            components: []
                        });
                    }
                    else if (i.values[0] === "new_category") {
                        // Cria uma nova categoria
                        try {
                            const newCategory = await interaction.guild.channels.create({
                                name: "Tickets",
                                type: ChannelType.GuildCategory,
                                permissionOverwrites: [
                                    {
                                        id: interaction.guild.id, // @everyone
                                        deny: [PermissionFlagsBits.ViewChannel]
                                    },
                                    {
                                        id: interaction.client.user.id, // Bot
                                        allow: [
                                            PermissionFlagsBits.ViewChannel,
                                            PermissionFlagsBits.SendMessages,
                                            PermissionFlagsBits.ManageChannels,
                                            PermissionFlagsBits.ManageMessages
                                        ]
                                    }
                                ]
                            });
                            
                            // Define a categoria para o sistema de tickets
                            ticketData.categoryId = newCategory.id;
                            saveGuildTickets(interaction.guild.id, ticketData);
                            
                            await i.editReply({
                                content: `✅ New category "${newCategory.name}" created and configured successfully!`,
                                components: []
                            });
                        } catch (error) {
                            console.error("Error creating category:", error);
                            
                            await i.editReply({
                                content: `❌ Error creating new category: ${error.message}`,
                                components: []
                            });
                        }
                    }
                    else {
                        // Define a categoria selecionada
                        ticketData.categoryId = i.values[0];
                        saveGuildTickets(interaction.guild.id, ticketData);
                        
                        const selectedCategory = interaction.guild.channels.cache.get(i.values[0]);
                        
                        await i.editReply({
                            content: `✅ Category "${selectedCategory.name}" configured successfully!`,
                            components: []
                        });
                    }
                    
                    // Atualiza a mensagem principal
                    await interaction.editReply({
                        embeds: [createSetupEmbed()],
                        components: [row1, row2, row3]
                    });
                });
                
                categoryCollector.on("end", async (collected, reason) => {
                    if (reason === "time" && collected.size === 0) {
                        await categoryMsg.edit({
                            content: "⏱️ Time expired. No category was selected.",
                            components: []
                        });
                    }
                });
                break;
                
            case "ticket_log":
                // Obtém todos os canais de texto do servidor
                const textChannels = interaction.guild.channels.cache.filter(c => 
                    c.type === ChannelType.GuildText && 
                    c.permissionsFor(interaction.client.user).has([
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.EmbedLinks
                    ])
                );
                
                if (textChannels.size === 0) {
                    return i.followUp({
                        content: "I couldn't find any text channels on the server.",
                        flags: MessageFlags.Ephemeral
                    });
                }
                
                // Prepara opções para o menu de seleção
                const channelOptions = [];
                
                // Adiciona opção para criar novo canal
                channelOptions.push({
                    label: "✨ Create New Channel",
                    description: "Creates a new channel for ticket logs",
                    value: "new_channel"
                });
                
                // Adiciona opção para remover canal (se existir um configurado)
                if (ticketData.logChannelId) {
                    channelOptions.push({
                        label: "❌ Remove Current Channel",
                        description: "Removes the currently set log channel",
                        value: "remove_channel"
                    });
                }
                
                // Adiciona todos os canais existentes
                textChannels.forEach(channel => {
                    channelOptions.push({
                        label: channel.name,
                        description: `ID: ${channel.id}`,
                        value: channel.id
                    });
                });
                
                // Cria o menu de seleção
                const channelRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("ticket_log_channel_select")
                        .setPlaceholder("Select a channel")
                        .addOptions(channelOptions)
                );
                
                // Envia o menu
                const channelMsg = await i.followUp({
                    content: "Select the channel where ticket logs will be sent:",
                    components: [channelRow],
                    flags: MessageFlags.Ephemeral
                });
                
                // Coletor para o menu de canais
                const channelCollector = channelMsg.createMessageComponentCollector({
                    filter: i => i.user.id === interaction.user.id && i.customId === "ticket_log_channel_select",
                    time: 60000, // 1 minuto
                    max: 1
                });
                
                channelCollector.on("collect", async i => {
                    await i.deferUpdate();
                    
                    if (i.values[0] === "remove_channel") {
                        // Remove o canal atual
                        ticketData.logChannelId = null;
                        saveGuildTickets(interaction.guild.id, ticketData);
                        
                        await i.editReply({
                            content: "✅ Log channel removed successfully!",
                            components: []
                        });
                    }
                    else if (i.values[0] === "new_channel") {
                        // Cria um novo canal
                        try {
                            const newChannel = await interaction.guild.channels.create({
                                name: "ticket-logs",
                                type: ChannelType.GuildText,
                                permissionOverwrites: [
                                    {
                                        id: interaction.guild.id, // @everyone
                                        deny: [PermissionFlagsBits.ViewChannel]
                                    },
                                    {
                                        id: interaction.client.user.id, // Bot
                                        allow: [
                                            PermissionFlagsBits.ViewChannel,
                                            PermissionFlagsBits.SendMessages,
                                            PermissionFlagsBits.EmbedLinks
                                        ]
                                    }
                                ]
                            });
                            
                            // Define o canal para logs
                            ticketData.logChannelId = newChannel.id;
                            saveGuildTickets(interaction.guild.id, ticketData);
                            
                            await i.editReply({
                                content: `✅ New channel "${newChannel.name}" created and configured successfully!`,
                                components: []
                            });
                        } catch (error) {
                            console.error("Error creating channel:", error);
                            
                            await i.editReply({
                                content: `❌ Error creating new channel: ${error.message}`,
                                components: []
                            });
                        }
                    }
                    else {
                        // Define o canal selecionado
                        ticketData.logChannelId = i.values[0];
                        saveGuildTickets(interaction.guild.id, ticketData);
                        
                        const selectedChannel = interaction.guild.channels.cache.get(i.values[0]);
                        
                        await i.editReply({
                            content: `✅ Channel "${selectedChannel.name}" configured successfully for logs!`,
                            components: []
                        });
                    }
                    
                    // Atualiza a mensagem principal
                    await interaction.editReply({
                        embeds: [createSetupEmbed()],
                        components: [row1, row2, row3]
                    });
                });
                
                channelCollector.on("end", async (collected, reason) => {
                    if (reason === "time" && collected.size === 0) {
                        await channelMsg.edit({
                            content: "⏱️ Time expired. No channel was selected.",
                            components: []
                        });
                    }
                });
                break;
                
            case "ticket_roles":
                // Obtém todos os cargos do servidor
                const allRoles = await interaction.guild.roles.fetch();
                
                // Filtra os cargos que o bot pode atribuir
                const availableRoles = allRoles.filter(role => 
                    role.position < interaction.guild.members.me.roles.highest.position && 
                    !role.managed && 
                    role.id !== interaction.guild.id
                );
                
                if (availableRoles.size === 0) {
                    return i.followUp({
                        content: "I couldn't find any roles that I can manage.",
                        flags: MessageFlags.Ephemeral
                    });
                }
                
                // Prepara as opções para o menu de seleção
                const roleOptions = Array.from(availableRoles.values()).map(role => ({
                    label: role.name.length > 25 ? role.name.substring(0, 22) + "..." : role.name,
                    description: `ID: ${role.id}`,
                    value: role.id
                }));
                
                // Cria o menu de seleção
                const roleMenu = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("ticket_roles_select")
                        .setPlaceholder("Select the support roles")
                        .setMinValues(0)
                        .setMaxValues(Math.min(roleOptions.length, 25))
                        .addOptions(roleOptions)
                );
                
                // Envia o menu
                const roleMsg = await i.followUp({
                    content: "Select the roles that will have access to tickets:",
                    components: [roleMenu],
                    flags: MessageFlags.Ephemeral
                });
                
                // Coletor para o menu
                const roleCollector = roleMsg.createMessageComponentCollector({
                    filter: i => i.user.id === interaction.user.id && i.customId === "ticket_roles_select",
                    time: 60000, // 1 minuto
                    max: 1
                });
                
                roleCollector.on("collect", async i => {
                    await i.deferUpdate();
                    
                    // Define os cargos selecionados
                    ticketData.supportRoleIds = i.values;
                    saveGuildTickets(interaction.guild.id, ticketData);
                    
                    // Obtém os nomes dos cargos
                    const selectedRoles = i.values.map(id => {
                        const role = interaction.guild.roles.cache.get(id);
                        return role ? role.name : `Unknown role (${id})`;
                    });
                    
                    await i.editReply({
                        content: `✅ ${selectedRoles.length} support role(s) configured successfully!`,
                        components: []
                    });
                    
                    // Atualiza a mensagem principal
                    await interaction.editReply({
                        embeds: [createSetupEmbed()],
                        components: [row1, row2, row3]
                    });
                });
                
                roleCollector.on("end", async (collected, reason) => {
                    if (reason === "time" && collected.size === 0) {
                        await roleMsg.edit({
                            content: "⏱️ Time expired. No roles were selected.",
                            components: []
                        });
                    }
                });
                break;
                
            case "ticket_types":
                // Mostra os tipos de tickets configurados
                await handleTicketTypes(interaction, ticketData);
                break;
                
            case "ticket_welcome":
                // Solicita a nova mensagem de boas-vindas
                await i.followUp({
                    content: `**Current Welcome Message:**\n\n${ticketData.welcomeMessage}\n\nType the new welcome message that will be displayed when a ticket is created:`,
                    flags: MessageFlags.Ephemeral
                });
                
                // Cria um coletor para a próxima mensagem do usuário
                const messageCollector = interaction.channel.createMessageCollector({
                    filter: m => m.author.id === interaction.user.id,
                    time: 180000, // 3 minutos
                    max: 1
                });
                
                messageCollector.on("collect", async m => {
                    // Tenta deletar a mensagem do usuário para manter o chat limpo
                    try {
                        await m.delete().catch(() => {});
                    } catch (error) {
                        console.error("Could not delete the message:", error);
                    }
                    
                    // Salva a nova mensagem
                    ticketData.welcomeMessage = m.content;
                    saveGuildTickets(interaction.guild.id, ticketData);
                    
                    // Notifica sobre a atualização
                    await i.editReply({
                        content: "✅ Welcome message updated successfully!",
                        flags: MessageFlags.Ephemeral
                    });
                    
                    // Atualiza a mensagem principal
                    await interaction.editReply({
                        embeds: [createSetupEmbed()],
                        components: [row1, row2, row3]
                    });
                });
                
                messageCollector.on("end", async (collected, reason) => {
                    if (reason === "time" && collected.size === 0) {
                        await i.editReply({
                            content: "⏱️ Time expired. The welcome message was not updated.",
                            flags: MessageFlags.Ephemeral
                        });
                    }
                });
                break;
        }
    });
    
    // Processa mensagens para entrada de texto
    messageCollector.on("collect", async message => {
        // Ignora mensagens que não são do usuário que está configurando
        if (message.author.id !== interaction.user.id) return;
        
        // Verifica se estamos aguardando uma mensagem
        if (configState.waitingForMessage) {
            // Tenta excluir a mensagem para manter o chat limpo
            try {
                await message.delete().catch(() => {});
            } catch (error) {
                console.error("Could not delete the message:", error);
            }
            
            // Processa diferentes tipos de configuração
            if (configState.configType === "welcome_message") {
                // Define a nova mensagem de boas-vindas
                ticketData.welcomeMessage = message.content;
                saveGuildTickets(interaction.guild.id, ticketData);
                
                await interaction.followUp({
                    content: "✅ Welcome message updated successfully!",
                    flags: MessageFlags.Ephemeral
                });
                
                // Reseta o estado
                configState.waitingForMessage = false;
                configState.configType = null;
            }
        }
    });
    
    // Tratamento do fim do tempo do configurador
    collector.on("end", async (collected, reason) => {
        if (reason === "time") {
            // Exibe mensagem de tempo esgotado
            const timeoutEmbed = new EmbedBuilder()
                .setTitle("⏱️ Time Expired")
                .setColor("#FF0000")
                .setDescription("The ticket configuration session has been closed due to inactivity.");
            
            // Desativa todos os botões
            const disabledRow1 = new ActionRowBuilder().addComponents(
                row1.components.map(button => 
                    new ButtonBuilder()
                        .setCustomId(button.customId)
                        .setLabel(button.label)
                        .setStyle(button.style)
                        .setEmoji(button.emoji)
                        .setDisabled(true)
                )
            );
            
            const disabledRow2 = new ActionRowBuilder().addComponents(
                row2.components.map(button => 
                    new ButtonBuilder()
                        .setCustomId(button.customId)
                        .setLabel(button.label)
                        .setStyle(button.style)
                        .setEmoji(button.emoji)
                        .setDisabled(true)
                )
            );
            
            const disabledRow3 = new ActionRowBuilder().addComponents(
                row3.components.map(button => 
                    new ButtonBuilder()
                        .setCustomId(button.customId)
                        .setLabel(button.label)
                        .setStyle(button.style)
                        .setEmoji(button.emoji)
                        .setDisabled(true)
                )
            );
            
            await interaction.editReply({
                embeds: [timeoutEmbed],
                components: [disabledRow1, disabledRow2, disabledRow3]
            }).catch(console.error);
            
            // Para o coletor de mensagens também
            messageCollector.stop();
        }
    });
}

// Nova implementação - método alternativo sem modais
async function handleTicketTypes(interaction, ticketData) {
    // Cria um embed para exibir os tipos atuais
    const embed = new EmbedBuilder()
        .setTitle("🏷️ Ticket Types")
        .setColor(interaction.client.config.embedColor)
        .setDescription("Manage the ticket types available to your users.");
    
    // Adiciona os tipos atuais ao embed
    ticketData.ticketTypes.forEach((type, index) => {
        embed.addFields(`${index + 1}. ${type.emoji} ${type.name}`, type.description || "No description");
    });
    
    // Botões para gerenciar os tipos
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_type_add")
            .setLabel("Add Type")
            .setStyle(ButtonStyle.Success)
            .setEmoji("➕"),
        new ButtonBuilder()
            .setCustomId("ticket_type_edit")
            .setLabel("Edit Type")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("✏️")
            .setDisabled(ticketData.ticketTypes.length === 0),
        new ButtonBuilder()
            .setCustomId("ticket_type_remove")
            .setLabel("Remove Type")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("🗑️")
            .setDisabled(ticketData.ticketTypes.length === 0),
        new ButtonBuilder()
            .setCustomId("ticket_type_back")
            .setLabel("Back")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("⬅️")
    );
    
    // Envia a mensagem
    const message = await interaction.followUp({
        embeds: [embed],
        components: [row],
        flags: MessageFlags.Ephemeral
    });
    
    // Coletor para os botões
    const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 300000 // 5 minutos
    });
    
    collector.on("collect", async i => {
        // NÃO use deferUpdate para botões que mostrarão modais
        if (i.customId === "ticket_type_add") {
            // Cria os componentes do modal
            const idInput = new TextInputBuilder()
                .setCustomId('ticket_type_id')
                .setLabel("ID (unique, no spaces)")
                .setStyle(TextInputStyle.Short)
                .setMinLength(3)
                .setMaxLength(20)
                .setPlaceholder('Ex: support, report, suggestion')
                .setRequired(true);
            
            const nameInput = new TextInputBuilder()
                .setCustomId('ticket_type_name')
                .setLabel("Name")
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(30)
                .setPlaceholder('Ex: General Support')
                .setRequired(true);
                
            const emojiInput = new TextInputBuilder()
                .setCustomId('ticket_type_emoji')
                .setLabel("Emoji")
                .setStyle(TextInputStyle.Short)
                .setMinLength(1)
                .setMaxLength(10)
                .setPlaceholder('Ex: 🔧, 🚨, 💡')
                .setRequired(true);
                
            const descriptionInput = new TextInputBuilder()
                .setCustomId('ticket_type_description')
                .setLabel("Description")
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(1)
                .setMaxLength(100)
                .setPlaceholder('Ex: Get general help with the server')
                .setRequired(true);
            
            // Cria as ActionRows com os componentes
            const firstRow = new ActionRowBuilder().addComponents(idInput);
            const secondRow = new ActionRowBuilder().addComponents(nameInput);
            const thirdRow = new ActionRowBuilder().addComponents(emojiInput);
            const fourthRow = new ActionRowBuilder().addComponents(descriptionInput);
            
            // Cria o modal com os componentes
            const modal = new ModalBuilder()
                .setCustomId('ticket_type_add_modal')
                .setTitle('Add Ticket Type')
                .addComponents(firstRow, secondRow, thirdRow, fourthRow);
            
            // Mostra o modal
            try {
                await i.showModal(modal);
            } catch (error) {
                console.error("Error showing modal:", error);
                // Se falhar, usamos uma mensagem de erro como fallback
                //await i.reply({ 
                    //content: `❌ Error opening form: ${error.message}`, 
                    //flags: MessageFlags.Ephemeral 
                //}).catch(console.error);
            }
            return;
        } else if (i.customId === "ticket_type_edit") {
            // Para este botão, usamos deferUpdate porque vamos mostrar um menu primeiro
            await i.deferUpdate().catch(console.error);
            
            if (ticketData.ticketTypes.length === 0) {
                await i.followUp({
                    content: "There are no ticket types to edit.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
            
            // Cria as opções para o menu de seleção
            const editOptions = ticketData.ticketTypes.map((type, index) => ({
                label: type.name,
                description: type.description.substring(0, 50) + (type.description.length > 50 ? "..." : ""),
                value: index.toString(),
                emoji: type.emoji
            }));
            
            // Cria o menu de seleção
            const editMenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("ticket_type_edit_select")
                    .setPlaceholder("Select a type to edit")
                    .addOptions(editOptions)
            );
            
            // Envia o menu
            const editMsg = await i.followUp({
                content: "Select the ticket type you want to edit:",
                components: [editMenu],
                flags: MessageFlags.Ephemeral
            });
            
            // Coletor para o menu
            const editCollector = editMsg.createMessageComponentCollector({
                filter: j => j.user.id === interaction.user.id && j.customId === "ticket_type_edit_select",
                time: 60000, // 1 minuto
                max: 1
            });
            
            editCollector.on("collect", async j => {
                // NÃO use deferUpdate aqui porque vamos mostrar um modal
                
                // Obtém o índice do tipo selecionado
                const typeIndex = parseInt(j.values[0]);
                const typeToEdit = ticketData.ticketTypes[typeIndex];
                
                // Cria os componentes do modal
                const idInput = new TextInputBuilder()
                    .setCustomId('ticket_type_id')
                    .setLabel("ID (unique, no spaces)")
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(3)
                    .setMaxLength(20)
                    .setValue(typeToEdit.id)
                    .setPlaceholder('Ex: support, report, suggestion')
                    .setRequired(true);
                
                const nameInput = new TextInputBuilder()
                    .setCustomId('ticket_type_name')
                    .setLabel("Name")
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(30)
                    .setValue(typeToEdit.name)
                    .setPlaceholder('Ex: General Support')
                    .setRequired(true);
                    
                const emojiInput = new TextInputBuilder()
                    .setCustomId('ticket_type_emoji')
                    .setLabel("Emoji")
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(10)
                    .setValue(typeToEdit.emoji)
                    .setPlaceholder('Ex: 🔧, 🚨, 💡')
                    .setRequired(true);
                    
                const descriptionInput = new TextInputBuilder()
                    .setCustomId('ticket_type_description')
                    .setLabel("Description")
                    .setStyle(TextInputStyle.Paragraph)
                    .setMinLength(1)
                    .setMaxLength(100)
                    .setValue(typeToEdit.description)
                    .setPlaceholder('Ex: Get general help with the server')
                    .setRequired(true);
                
                // Cria as ActionRows com os componentes
                const firstRow = new ActionRowBuilder().addComponents(idInput);
                const secondRow = new ActionRowBuilder().addComponents(nameInput);
                const thirdRow = new ActionRowBuilder().addComponents(emojiInput);
                const fourthRow = new ActionRowBuilder().addComponents(descriptionInput);
                
                // Cria o modal com os componentes
                const modal = new ModalBuilder()
                    .setCustomId(`ticket_type_edit_modal_${typeIndex}`)
                    .setTitle('Edit Ticket Type')
                    .addComponents(firstRow, secondRow, thirdRow, fourthRow);
                
                // Mostra o modal
                try {
                    await j.showModal(modal);
                } catch (error) {
                    console.error("Error showing edit modal:", error);
                    await j.reply({ 
                        content: `❌ Error opening edit form: ${error.message}`,
                        flags: MessageFlags.Ephemeral 
                    }).catch(console.error);
                }
            });
            
            editCollector.on("end", async (collected, reason) => {
                if (reason === "time" && collected.size === 0) {
                    await editMsg.edit({
                        content: "⏱️ Time expired. No type was selected.",
                        components: []
                    }).catch(console.error);
                }
            });
        } else {
            // Para outros botões, usamos deferUpdate normalmente
            await i.deferUpdate().catch(console.error);
            
            if (i.customId === "ticket_type_remove") {
                // Verifica se existem tipos para remover
                if (ticketData.ticketTypes.length === 0) {
                    await i.followUp({
                        content: "There are no ticket types to remove.",
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                
                // Cria as opções para o menu de seleção
                const removeOptions = ticketData.ticketTypes.map((type, index) => ({
                    label: type.name,
                    description: type.description.substring(0, 50) + (type.description.length > 50 ? "..." : ""),
                    value: index.toString(),
                    emoji: type.emoji
                }));
                
                // Cria o menu de seleção
                const removeMenu = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("ticket_type_remove_select")
                        .setPlaceholder("Select a type to remove")
                        .addOptions(removeOptions)
                );
                
                // Envia o menu
                const removeMsg = await i.followUp({
                    content: "Select the ticket type you want to remove:",
                    components: [removeMenu],
                    flags: MessageFlags.Ephemeral
                });
                
                // Coletor para o menu
                const removeCollector = removeMsg.createMessageComponentCollector({
                    filter: j => j.user.id === interaction.user.id && j.customId === "ticket_type_remove_select",
                    time: 60000, // 1 minuto
                    max: 1
                });
                
                removeCollector.on("collect", async j => {
                    await j.deferUpdate();
                    
                    // Obtém o índice do tipo selecionado
                    const typeIndex = parseInt(j.values[0]);
                    const typeToRemove = ticketData.ticketTypes[typeIndex];
                    
                    // Confirma a remoção
                    const confirmRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("ticket_type_remove_confirm")
                            .setLabel("Confirm Removal")
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji("✅"),
                        new ButtonBuilder()
                            .setCustomId("ticket_type_remove_cancel")
                            .setLabel("Cancel")
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji("❌")
                    );
                    
                    await j.editReply({
                        content: `Are you sure you want to remove the ticket type "${typeToRemove.emoji} ${typeToRemove.name}"?\n\nThis action cannot be undone.`,
                        components: [confirmRow]
                    });
                    
                    // Coletor para a confirmação
                    const confirmCollector = j.message.createMessageComponentCollector({
                        filter: k => k.user.id === interaction.user.id && 
                                    (k.customId === "ticket_type_remove_confirm" || k.customId === "ticket_type_remove_cancel"),
                        time: 30000, // 30 segundos
                        max: 1
                    });
                    
                    confirmCollector.on("collect", async k => {
                        await k.deferUpdate();
                        
                        if (k.customId === "ticket_type_remove_confirm") {
                            // Remove o tipo
                            ticketData.ticketTypes.splice(typeIndex, 1);
                            saveGuildTickets(interaction.guild.id, ticketData);
                            
                            await k.editReply({
                                content: `✅ Ticket type "${typeToRemove.emoji} ${typeToRemove.name}" successfully removed!`,
                                components: []
                            });
                            
                            // Atualiza a exibição dos tipos
                            await handleTicketTypes(interaction, ticketData);
                        } else if (k.customId === "ticket_type_remove_cancel") {
                            await k.editReply({
                                content: "❌ Removal canceled.",
                                components: []
                            });
                        }
                    });
                    
                    confirmCollector.on("end", async (collected, reason) => {
                        if (reason === "time" && collected.size === 0) {
                            await j.editReply({
                                content: "⏱️ Time expired. The removal was canceled.",
                                components: []
                            }).catch(console.error);
                        }
                    });
                });
                
                removeCollector.on("end", async (collected, reason) => {
                    if (reason === "time" && collected.size === 0) {
                        await removeMsg.edit({
                            content: "⏱️ Time expired. No type was selected.",
                            components: []
                        }).catch(console.error);
                    }
                });
            } else if (i.customId === "ticket_type_back") {
                // Volta para a configuração principal
                collector.stop();
            }
        }
    });
    
    collector.on("end", async () => {
        // Não faz nada específico ao encerrar
    });
}

// Função alternativa para adicionar tipo sem usar modal
async function addTicketTypeAlternative(interaction, originalInteraction, ticketData) {
    // Envia mensagem solicitando os dados
    const promptMsg = await interaction.followUp({
        content: "**Add New Ticket Type**\n\nAnswer the following questions to create a new ticket type.",
        flags: MessageFlags.Ephemeral
    });
    
    // Estado para rastrear as respostas
    const responses = {
        id: null,
        name: null,
        emoji: null,
        description: null
    };
    
    // Função para criar o menu de cada etapa
    function createPromptMenu(step) {
        let content = "**Add New Ticket Type**\n\n";
        
        switch (step) {
            case 1:
                content += "**Step 1/4: Type ID**\nEnter the unique ID for this ticket type (no spaces, example: 'support', 'bug', 'payment')";
                break;
            case 2:
                content += "**Step 2/4: Type Name**\nEnter the name that will be displayed for this ticket type (example: 'General Support', 'Report Bug')";
                break;
            case 3:
                content += "**Step 3/4: Type Emoji**\nEnter the emoji that will represent this ticket type (example: 🔧, 🚨, 💰)";
                break;
            case 4:
                content += "**Step 4/4: Type Description**\nEnter a brief description for this ticket type";
                break;
        }
        
        return content;
    }
    
    // Botão para cancelar o processo
    const cancelRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_add_cancel")
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("❌")
    );
    
    // Atualiza a mensagem para a primeira etapa
    await promptMsg.edit({
        content: createPromptMenu(1),
        components: [cancelRow]
    });
    
    // Coletor para o botão de cancelar
    const buttonCollector = promptMsg.createMessageComponentCollector({
        filter: i => i.user.id === originalInteraction.user.id && i.customId === "ticket_add_cancel",
        time: 300000 // 5 minutos
    });
    
    buttonCollector.on("collect", async i => {
        await i.deferUpdate().catch(console.error);
        
        await promptMsg.edit({
            content: "❌ Type addition process canceled.",
            components: []
        });
        
        buttonCollector.stop();
        messageCollector.stop("cancelled");
    });
    
    // Coletor para as mensagens
    const messageCollector = originalInteraction.channel.createMessageCollector({
        filter: m => m.author.id === originalInteraction.user.id,
        time: 300000 // 5 minutos
    });
    
    let currentStep = 1;
    
    messageCollector.on("collect", async message => {
        // Tenta deletar a mensagem para manter o chat limpo
        try {
            await message.delete().catch(() => {});
        } catch (error) {
            console.error("Could not delete message:", error);
        }
        
        // Processa a mensagem com base na etapa atual
        switch (currentStep) {
            case 1: // ID
                const id = message.content.trim().toLowerCase().replace(/\s+/g, "_");
                
                // Verifica se o ID já existe
                if (ticketData.ticketTypes.some(type => type.id === id)) {
                    await promptMsg.edit({
                        content: "❌ This ID is already used by another ticket type. Please choose a different ID.\n\n" + createPromptMenu(1),
                        components: [cancelRow]
                    });
                    return;
                }
                
                responses.id = id;
                currentStep = 2;
                
                await promptMsg.edit({
                    content: createPromptMenu(2),
                    components: [cancelRow]
                });
                break;
                
            case 2: // Nome
                responses.name = message.content.trim();
                currentStep = 3;
                
                await promptMsg.edit({
                    content: createPromptMenu(3),
                    components: [cancelRow]
                });
                break;
                
            case 3: // Emoji
                responses.emoji = message.content.trim();
                currentStep = 4;
                
                await promptMsg.edit({
                    content: createPromptMenu(4),
                    components: [cancelRow]
                });
                break;
                
            case 4: // Descrição
                responses.description = message.content.trim();
                
                // Finaliza o processo
                messageCollector.stop("completed");
                break;
        }
    });
    
    messageCollector.on("end", async (collected, reason) => {
        buttonCollector.stop();
        
        if (reason === "completed") {
            // Adiciona o novo tipo
            ticketData.ticketTypes.push({
                id: responses.id,
                name: responses.name,
                emoji: responses.emoji,
                description: responses.description
            });
            
            // Salva as alterações
            const success = saveGuildTickets(originalInteraction.guild.id, ticketData);
            
            if (success) {
                await promptMsg.edit({
                    content: `✅ Ticket type "${responses.emoji} ${responses.name}" added successfully!`,
                    components: []
                });
                
                // Atualiza a exibição dos tipos
                await handleTicketTypes(originalInteraction, ticketData);
            } else {
                await promptMsg.edit({
                    content: "❌ An error occurred while saving the ticket type. Please try again.",
                    components: []
                });
            }
        } else if (reason === "time") {
            await promptMsg.edit({
                content: "⏱️ Time expired. The type addition process has been canceled.",
                components: []
            });
        } else if (reason !== "cancelled") {
            await promptMsg.edit({
                content: "❌ Type addition process canceled or interrupted.",
                components: []
            });
        }
    });
}

// Handler para criar um painel de tickets
async function handleTicketPanel(interaction, ticketData) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    // Verifica se o sistema de tickets está configurado e ativado
    if (!ticketData.enabled) {
        return interaction.editReply("❌ The ticket system is not enabled. Use `/ticket setup` to enable the system first.");
    }
    
    if (!ticketData.categoryId) {
        return interaction.editReply("❌ The ticket category is not configured. Use `/ticket setup` to configure the category first.");
    }
    
    if (ticketData.ticketTypes.length === 0) {
        return interaction.editReply("❌ There are no ticket types configured. Use `/ticket setup` to add ticket types first.");
    }
    
    // Obtém o canal selecionado
    const channel = interaction.options.getChannel("channel");
    
    // Verifica se o bot tem permissão para enviar mensagens no canal
    if (!channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.SendMessages) || 
        !channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.EmbedLinks)) {
        return interaction.editReply(`I don't have permission to send messages or embeds in the channel ${channel}. Please adjust my permissions.`);
    }
    
    // Cria o embed do painel de tickets
    const panelEmbed = new EmbedBuilder()
        .setTitle("🎫 Ticket System")
        .setColor(interaction.client.config.embedColor)
        .setDescription("Click the button below to open a ticket and get support from our team.")
        .setFooter({ 
            text: `${interaction.guild.name} | Ticket System`, 
            iconURL: interaction.guild.iconURL({ dynamic: true }) 
        })
        .setTimestamp();
    
    // Adiciona os tipos de tickets ao embed
    let typesDescription = "";
    ticketData.ticketTypes.forEach(type => {
        typesDescription += `${type.emoji} **${type.name}**: ${type.description}\n\n`;
    });

    panelEmbed.addFields({ name: "Ticket Types:", value: typesDescription });
    
    // Cria o botão para abrir o ticket
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_create")
            .setLabel("Open Ticket")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("🎫")
    );
    
    // Envia o painel no canal selecionado
    try {
        await channel.send({
            embeds: [panelEmbed],
            components: [row]
        });
        
        await interaction.editReply(`✅ Ticket panel created successfully in the channel ${channel}!`);
    } catch (error) {
        console.error("Error creating ticket panel:", error);
        await interaction.editReply(`❌ Error creating ticket panel: ${error.message}`);
    }
}

// Handlers para adicionar/remover usuários e fechar tickets (sem alterações)
// ...

// Configura os handlers para modais do sistema de tickets
function setupTicketEvents(client) {
    // Handler para processa cliques em botões
    client.on("interactionCreate", async interaction => {
        if (!interaction.isButton()) return;

        if (interaction.customId === "ticket_type_select") {
            try {
                await interaction.deferUpdate();
                
                // Carrega os dados de tickets do servidor
                const ticketData = getGuildTickets(interaction.guild.id);
                
                // Obtém o tipo selecionado
                const selectedTypeId = interaction.values[0];
                
                // Cria o ticket
                await createTicket(interaction, ticketData, selectedTypeId);
            } catch (error) {
                console.error("Error processing ticket type selection:", error);
                // Tenta responder se ainda não tiver respondido
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: "❌ An error occurred while processing your selection. Please try again later.",
                        flags: MessageFlags.Ephemeral
                    }).catch(console.error);
                }
            }
        }
        
        // MODAL PARA ADICIONAR TIPO
        if (interaction.customId === "ticket_type_add") {
            try {
                // Cria o componente de ID
                const idInput = new TextInputBuilder()
                    .setCustomId("ticket_type_id")
                    .setLabel("ID (unique, no spaces)")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ex: support, report, suggestion")
                    .setMinLength(3)
                    .setMaxLength(20)
                    .setRequired(true);
                
                // Cria o componente de Nome
                const nameInput = new TextInputBuilder()
                    .setCustomId("ticket_type_name")
                    .setLabel("Name")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ex: Support General")
                    .setMinLength(1)
                    .setMaxLength(30)
                    .setRequired(true);
                
                // Cria o componente de Emoji
                const emojiInput = new TextInputBuilder()
                    .setCustomId("ticket_type_emoji")
                    .setLabel("Emoji")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ex: 🔧, 🚨, 💡")
                    .setMinLength(1)
                    .setMaxLength(10)
                    .setRequired(true);
                
                // Cria o componente de Descrição
                const descriptionInput = new TextInputBuilder()
                    .setCustomId("ticket_type_description")
                    .setLabel("Description")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder("Ex: Get help with the server")
                    .setMinLength(1)
                    .setMaxLength(100)
                    .setRequired(true);
                
                // Cria as ActionRows
                const idRow = new ActionRowBuilder().addComponents(idInput);
                const nameRow = new ActionRowBuilder().addComponents(nameInput);
                const emojiRow = new ActionRowBuilder().addComponents(emojiInput);
                const descriptionRow = new ActionRowBuilder().addComponents(descriptionInput);
                
                // Cria o Modal
                const modal = new ModalBuilder()
                    .setCustomId("ticket_type_add_modal")
                    .setTitle("Add Ticket Type")
                    .addComponents(idRow, nameRow, emojiRow, descriptionRow);
                
                // Mostra o modal
                await interaction.showModal(modal);
            } catch (error) {
                console.error("Error showing modal:", error);
                // Tenta uma resposta de fallback
                try {
                    //await interaction.reply({
                        //content: `❌ Error creating form: ${error.message}`,
                        //flags: MessageFlags.Ephemeral
                    //});
                } catch (replyError) {
                    console.error("Error sending fallback response:", replyError);
                }
            }
        }
    });
    
    // Handler para processar cliques em botões de tickets
    client.on("interactionCreate", async interaction => {
        if (!interaction.isButton()) return;

        if (interaction.customId === "ticket_create") {
            try {
                // Responde imediatamente à interação para evitar o erro "This interaction failed"
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                
                // Carrega os dados de tickets do servidor
                const ticketData = getGuildTickets(interaction.guild.id);
                
                // Verifica se o sistema está ativado
                if (!ticketData.enabled) {
                    return interaction.editReply("❌ The ticket system is currently disabled. Please try again later.");
                }
                
                // Verifica se o usuário já tem um ticket aberto
                const userHasTicket = Object.values(ticketData.activeTickets || {}).some(
                    ticket => ticket.userId === interaction.user.id
                );
                
                if (userHasTicket) {
                    return interaction.editReply("❌ You already have an open ticket. Please use the existing ticket or close it before opening a new one.");
                }
                
                // Verifica se há tipos de tickets configurados
                if (ticketData.ticketTypes.length === 0) {
                    return interaction.editReply("❌ There are no ticket types configured. Please contact an administrator.");
                }
                
                // Se houver apenas um tipo de ticket, cria o ticket diretamente
                if (ticketData.ticketTypes.length === 1) {
                    const ticketType = ticketData.ticketTypes[0];
                    await createTicket(interaction, ticketData, ticketType.id);
                    return;
                }
                
                // Cria um menu de seleção com os tipos de tickets
                const typeOptions = ticketData.ticketTypes.map(type => ({
                    label: type.name,
                    description: type.description.substring(0, 50) + (type.description.length > 50 ? "..." : ""),
                    value: type.id,
                    emoji: type.emoji
                }));
                
                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("ticket_type_select")
                        .setPlaceholder("Select ticket type")
                        .addOptions(typeOptions)
                );
                
                await interaction.editReply({
                    content: "Please select the type of ticket you want to create:",
                    components: [row]
                });
            } catch (error) {
                console.error("Error processing create ticket button:", error);
                // Tenta responder se ainda não tiver respondido
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: "❌ An error occurred while processing your request. Please try again later.",
                        flags: MessageFlags.Ephemeral
                    }).catch(console.error);
                } else {
                    await interaction.editReply({
                        content: "❌ An error occurred while processing your request. Please try again later."
                    }).catch(console.error);
                }
            }
        }

        
        // Processa o botão de fechar ticket
        if (interaction.customId === "ticket_close") {
            // Importante: Responder à interação imediatamente para evitar "interaction failed"
            await interaction.reply({ 
                content: "Processing request to close the ticket...", 
                flags: MessageFlags.Ephemeral 
            });
            
            // Carrega as configurações de tickets do servidor
            const guildId = interaction.guild.id;
            const ticketData = getGuildTickets(guildId);
            
            // Verifica se o canal atual é um ticket
            const ticketId = interaction.channel.name.split("-")[1];
            const isTicket = ticketData.activeTickets && ticketData.activeTickets[ticketId];
            
            if (!isTicket) {
                return interaction.editReply("❌ This channel is no longer a valid ticket.");
            }
            
            // Verifica se o usuário que executou o comando tem permissão
            const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                                ticketData.supportRoleIds.some(roleId => interaction.member.roles.cache.has(roleId)) ||
                                interaction.user.id === ticketData.activeTickets[ticketId].userId;
            
            if (!hasPermission) {
                return interaction.editReply("❌ You don't have permission to close this ticket.");
            }
            
            // Confirma o fechamento do ticket
            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("ticket_close_confirm")
                    .setLabel("Confirm Closure")
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji("✅"),
                new ButtonBuilder()
                    .setCustomId("ticket_close_cancel")
                    .setLabel("Cancelar")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("❌")
            );
            
            await interaction.editReply({
                content: "Are you sure you want to close this ticket?",
                components: [confirmRow]
            });
        }
        // Processa o botão de confirmação de fechamento
        else if (interaction.customId === "ticket_close_confirm") {
            await interaction.deferUpdate();
            
            // Carrega as configurações de tickets do servidor
            const guildId = interaction.guild.id;
            const ticketData = getGuildTickets(guildId);
            
            // Verifica se o canal atual é um ticket
            const ticketId = interaction.channel.name.split("-")[1];
            const isTicket = ticketData.activeTickets && ticketData.activeTickets[ticketId];
            
            if (!isTicket) {
                return interaction.followUp({
                    content: "❌ Este canal não é mais um ticket válido.",
                    flags: MessageFlags.Ephemeral
                });
            }
            
            // Notifica o canal que o ticket será fechado
            await interaction.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setTitle("Ticket Closed")
                        .setDescription(`This ticket was closed by ${interaction.user}`)
                        .setTimestamp()
                ]
            });
            
            // Prepara o log de fechamento
            let logEmbed = new EmbedBuilder()
                .setTitle(`Ticket #${ticketId} Closed`)
                .setColor(Colors.Red)
                .setDescription(`Ticket closed by ${interaction.user}`)
                .addFields({ name: "Ticket", value: `#${interaction.channel.name}` })
                .addFields({ name: "Type", value: ticketData.activeTickets[ticketId].type })
                .addFields({ name: "Created by", value: `<@${ticketData.activeTickets[ticketId].userId}>` })
                .addFields({ name: "Closed by", value: `${interaction.user}` })
                .setTimestamp();
            
            // Envia o log se o canal estiver configurado
            if (ticketData.logChannelId) {
                const logChannel = interaction.guild.channels.cache.get(ticketData.logChannelId);
                
                if (logChannel) {
                    try {
                        await logChannel.send({ embeds: [logEmbed] });
                    } catch (error) {
                        console.error("Error sending ticket log:", error);
                    }
                }
            }
            
            // Remove o ticket dos tickets ativos
            delete ticketData.activeTickets[ticketId];
            saveGuildTickets(interaction.guild.id, ticketData);
            
            // Espera 5 segundos e então deleta o canal
            setTimeout(async () => {
                try {
                    await interaction.channel.delete(`Ticket #${ticketId} closed by ${interaction.user.tag}`);
                } catch (error) {
                    console.error("Error deleting ticket channel:", error);
                }
            }, 5000);
        }
        // Processa o botão de cancelamento de fechamento
        else if (interaction.customId === "ticket_close_cancel") {
            await interaction.update({
                content: "Ticket closure canceled.",
                components: []
            });
        }
    });

    client.on("interactionCreate", async interaction => {
        if (!interaction.isModalSubmit()) return;
        
        // Processa o modal de adicionar tipo de ticket
        if (interaction.customId === "ticket_type_add_modal") {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            
            try {
                // Obtém os valores do modal
                const typeId = interaction.fields.getTextInputValue("ticket_type_id");
                const typeName = interaction.fields.getTextInputValue("ticket_type_name");
                const typeEmoji = interaction.fields.getTextInputValue("ticket_type_emoji");
                const typeDescription = interaction.fields.getTextInputValue("ticket_type_description");
                
                // Carrega os dados de tickets do servidor
                const ticketData = getGuildTickets(interaction.guild.id);
                
                // Verifica se o ID já existe
                const idExists = ticketData.ticketTypes.some(type => type.id === typeId);
                
                if (idExists) {
                    return interaction.editReply("❌ A ticket type with this ID already exists. Please choose a unique ID.");
                }
                
                // Adiciona o novo tipo
                ticketData.ticketTypes.push({
                    id: typeId,
                    name: typeName,
                    emoji: typeEmoji,
                    description: typeDescription
                });
                
                // Salva as alterações
                const success = saveGuildTickets(interaction.guild.id, ticketData);
                
                if (success) {
                    await interaction.editReply(`✅ Ticket type "${typeEmoji} ${typeName}" added successfully!`);
                    
                    // Atualiza a exibição dos tipos
                    await handleTicketTypes(interaction, ticketData);
                } else {
                    await interaction.editReply("❌ An error occurred while saving the ticket type. Please try again.");
                }
            } catch (error) {
                console.error("Error processing add modal:", error);
                await interaction.editReply(`❌ An error occurred while processing the form: ${error.message}`);
            }
        }
        // Processa o modal de editar tipo de ticket
        else if (interaction.customId.startsWith("ticket_type_edit_modal_")) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            
            try {
                // Obtém o índice do tipo a ser editado
                const typeIndex = parseInt(interaction.customId.split("_").pop());
                
                // Obtém os valores do modal
                const typeId = interaction.fields.getTextInputValue("ticket_type_id");
                const typeName = interaction.fields.getTextInputValue("ticket_type_name");
                const typeEmoji = interaction.fields.getTextInputValue("ticket_type_emoji");
                const typeDescription = interaction.fields.getTextInputValue("ticket_type_description");
                
                // Carrega os dados de tickets do servidor
                const ticketData = getGuildTickets(interaction.guild.id);
                
                // Verifica se o tipo existe
                if (!ticketData.ticketTypes[typeIndex]) {
                    return interaction.editReply("❌ Ticket type not found. It may have been removed.");
                }
                
                // Verifica se o ID já existe em outro tipo
                const idExists = ticketData.ticketTypes.some((type, index) => type.id === typeId && index !== typeIndex);
                
                if (idExists) {
                    return interaction.editReply("❌ This ID is already used by another ticket type. Please choose a unique ID.");
                }
                
                // Atualiza o tipo
                ticketData.ticketTypes[typeIndex] = {
                    id: typeId,
                    name: typeName,
                    emoji: typeEmoji,
                    description: typeDescription
                };
                
                // Salva as alterações
                const success = saveGuildTickets(interaction.guild.id, ticketData);
                
                if (success) {
                    await interaction.editReply(`✅ Ticket type "${typeEmoji} ${typeName}" updated successfully!`);
                    
                    // Atualiza a exibição dos tipos
                    await handleTicketTypes(interaction, ticketData);
                } else {
                    await interaction.editReply("❌ An error occurred while saving the changes. Please try again.");
                }
            } catch (error) {
                console.error("Error processing edit modal:", error);
                await interaction.editReply(`❌ An error occurred while processing the form: ${error.message}`);
            }
        }
    });
    
    // Handler para processar seleções de menu
    client.on("interactionCreate", async interaction => {
        if (!interaction.isStringSelectMenu()) return;
        
        if (interaction.customId === "ticket_type_edit_select") {
            try {
                // Carrega os dados de tickets do servidor
                const ticketData = getGuildTickets(interaction.guild.id);
                
                // Obtém o índice do tipo selecionado
                const typeIndex = parseInt(interaction.values[0]);
                const typeToEdit = ticketData.ticketTypes[typeIndex];
                
                // Cria o componente de ID
                const idInput = new TextInputBuilder()
                    .setCustomId("ticket_type_id")
                    .setLabel("ID (unique, no spaces)")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ex: support, report, suggestion")
                    .setValue(typeToEdit.id)
                    .setMinLength(3)
                    .setMaxLength(20)
                    .setRequired(true);
                
                // Cria o componente de Nome
                const nameInput = new TextInputBuilder()
                    .setCustomId("ticket_type_name")
                    .setLabel("Name")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ex: Support General")
                    .setValue(typeToEdit.name)
                    .setMinLength(1)
                    .setMaxLength(30)
                    .setRequired(true);
                
                // Cria o componente de Emoji
                const emojiInput = new TextInputBuilder()
                    .setCustomId("ticket_type_emoji")
                    .setLabel("Emoji")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Ex: 🔧, 🚨, 💡")
                    .setValue(typeToEdit.emoji)
                    .setMinLength(1)
                    .setMaxLength(10)
                    .setRequired(true);
                
                // Cria o componente de Descrição
                const descriptionInput = new TextInputBuilder()
                    .setCustomId("ticket_type_description")
                    .setLabel("Description")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder("Ex: Get help with the server")
                    .setValue(typeToEdit.description)
                    .setMinLength(1)
                    .setMaxLength(100)
                    .setRequired(true);
                
                // Cria as ActionRows
                const idRow = new ActionRowBuilder().addComponents(idInput);
                const nameRow = new ActionRowBuilder().addComponents(nameInput);
                const emojiRow = new ActionRowBuilder().addComponents(emojiInput);
                const descriptionRow = new ActionRowBuilder().addComponents(descriptionInput);
                
                // Cria o Modal
                const modal = new ModalBuilder()
                    .setCustomId(`ticket_type_edit_modal_${typeIndex}`)
                    .setTitle("Edit Ticket Type")
                    .addComponents(idRow, nameRow, emojiRow, descriptionRow);
                
                // Mostra o modal
                await interaction.showModal(modal);
            } catch (error) {
                console.error("Error showing edit modal:", error);
                // Tenta uma resposta de fallback
                try {
                    await interaction.reply({
                        content: `❌ Error creating edit form: ${error.message}`,
                        flags: MessageFlags.Ephemeral
                    });
                } catch (replyError) {
                    console.error("Error sending fallback response:", replyError);
                }
            }
        }
    });
    
    console.log("Ticket events configured successfully!");
}

// Função para criar um ticket
async function createTicket(interaction, ticketData, typeId) {
    try {
        // Verifica se a categoria existe
        const category = interaction.guild.channels.cache.get(ticketData.categoryId);
        
        if (!category) {
            return interaction.editReply("❌ The ticket category was not found. Please contact an administrator.");
        }
        
        // Obtém o tipo de ticket
        const ticketType = ticketData.ticketTypes.find(type => type.id === typeId);
        
        if (!ticketType) {
            return interaction.editReply("❌ Invalid ticket type. Please try again.");
        }
        
        // Incrementa o contador de tickets
        ticketData.ticketCounter = (ticketData.ticketCounter || 0) + 1;
        const ticketNumber = ticketData.ticketCounter;
        
        // Cria o nome do canal
        const channelName = `ticket-${ticketNumber}-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
        
        // Prepara as permissões do canal
        const channelPermissions = [
            // Esconde o canal de todos
            {
                id: interaction.guild.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            // Dá acesso ao bot
            {
                id: interaction.client.user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
            },
            // Dá acesso ao criador do ticket
            {
                id: interaction.user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
            }
        ];
        
        // Adiciona permissões para os cargos de suporte
        if (ticketData.supportRoleIds && ticketData.supportRoleIds.length > 0) {
            for (const roleId of ticketData.supportRoleIds) {
                channelPermissions.push({
                    id: roleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                });
            }
        }
        
        // Cria o canal do ticket
        const ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: category,
            permissionOverwrites: channelPermissions,
            topic: `Ticket from ${interaction.user.tag} | Type: ${ticketType.name} | ID: ${ticketNumber}`
        });
        
        // Salva o ticket nos tickets ativos
        if (!ticketData.activeTickets) ticketData.activeTickets = {};
        
        ticketData.activeTickets[ticketNumber] = {
            channelId: ticketChannel.id,
            userId: interaction.user.id,
            creatorId: interaction.user.id,
            type: ticketType.name,
            createdAt: Date.now()
        };
        
        saveGuildTickets(interaction.guild.id, ticketData);
        
        // Cria o embed de boas-vindas
        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`${ticketType.emoji} Ticket: ${ticketType.name}`)
            .setColor(interaction.client.config.embedColor)
            .setDescription(ticketData.welcomeMessage || "Thank you for opening a ticket! Our support team will assist you shortly.")
            .addFields({ name: "Ticket created by", value: `${interaction.user}` })
            .addFields({ name: "Ticket Type", value: `${ticketType.emoji} ${ticketType.name}` })
            .addFields({ name: "Ticket ID", value: `#${ticketNumber}` })
            .setFooter({ 
                text: `${interaction.guild.name} | Ticket System`, 
                iconURL: interaction.guild.iconURL({ dynamic: true }) 
            })
            .setTimestamp();
        
        // Botões para o ticket
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ticket_close")
                .setLabel("Close Ticket")
                .setStyle(ButtonStyle.Danger)
                .setEmoji("🔒")
        );
        
        // Envia a mensagem de boas-vindas
        await ticketChannel.send({
            content: `${interaction.user} | ${ticketData.supportRoleIds.map(id => `<@&${id}>`).join(" ")}`,
            embeds: [welcomeEmbed],
            components: [row]
        });
        
        // Notifica o usuário
        await interaction.editReply({
            content: `✅ Your ticket has been created successfully! Please go to ${ticketChannel} to get support.`,
            components: []
        });
        
        // Envia log de criação se o canal estiver configurado
        if (ticketData.logChannelId) {
            const logChannel = interaction.guild.channels.cache.get(ticketData.logChannelId);
            
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle(`Ticket #${ticketNumber} Created`)
                    .setColor(interaction.client.config.embedColor)
                    .setDescription(`A new ticket has been created by ${interaction.user}`)
                    .addFields({ name: "Ticket", value: `<#${ticketChannel.id}>` })
                    .addFields({ name: "Type", value: ticketType.name })
                    .addFields({ name: "ID", value: `#${ticketNumber}` })
                    .setTimestamp();
                
                await logChannel.send({ embeds: [logEmbed] });
            }
        }
    } catch (error) {
        console.error("Error creating ticket:", error);
        await interaction.editReply({
            content: `❌ An error occurred while creating the ticket: ${error.message}`,
            components: []
        });
    }
}

async function handleTicketSettings(interaction, ticketData) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    // Cria o embed com as configurações atuais
    function createSettingsEmbed() {
        const embed = new EmbedBuilder()
            .setTitle("⚙️ Ticket System Settings")
            .setColor(interaction.client.config.embedColor)
            .setDescription("Configure the ticket system settings. Click the buttons below to modify each setting.");
        
        // Status do sistema
        embed.addFields({ name: "System Status", value: ticketData.enabled ? "✅ Enabled" : "❌ Disabled" });
        
        // Categoria
        const category = ticketData.categoryId ? interaction.guild.channels.cache.get(ticketData.categoryId) : null;
        embed.addFields({ name: "Ticket Category", value: category ? `📁 ${category.name}` : "❌ Not configured" });
        
        // Canal de logs
        const logChannel = ticketData.logChannelId ? interaction.guild.channels.cache.get(ticketData.logChannelId) : null;
        embed.addFields({ name: "Log Channel", value: logChannel ? `📋 ${logChannel.name}` : "❌ Not configured" });
        
        // Cargos de suporte
        let supportRoles = "None";
        if (ticketData.supportRoleIds && ticketData.supportRoleIds.length > 0) {
            supportRoles = ticketData.supportRoleIds.map(roleId => {
                const role = interaction.guild.roles.cache.get(roleId);
                return role ? `<@&${roleId}>` : `Unknown role (${roleId})`;
            }).join(", ");
        }
        embed.addFields({ name: "Support Roles", value: supportRoles });
        
        // Tipos de ticket
        let ticketTypes = "None";
        if (ticketData.ticketTypes && ticketData.ticketTypes.length > 0) {
            ticketTypes = ticketData.ticketTypes.map(type => 
                `${type.emoji} **${type.name}** - ${type.description}`
            ).join("\n");
        }
        embed.addFields({ name: "Ticket Types", value: ticketTypes });
        
        // Mensagem de boas-vindas
        embed.addFields({ name: "Welcome Message", value: ticketData.welcomeMessage || "Default message" });
        
        return embed;
    }
    
    // Botões para configurar as opções
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_toggle")
            .setLabel(ticketData.enabled ? "Disable System" : "Enable System")
            .setStyle(ticketData.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
            .setEmoji(ticketData.enabled ? "🔴" : "🟢"),
        new ButtonBuilder()
            .setCustomId("ticket_category")
            .setLabel("Category")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("📁")
    );
    
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_log_channel")
            .setLabel("Log Channel")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("📋"),
        new ButtonBuilder()
            .setCustomId("ticket_support_roles")
            .setLabel("Support Roles")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("👥")
    );
    
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_types")
            .setLabel("Ticket Types")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("🏷️"),
        new ButtonBuilder()
            .setCustomId("ticket_welcome")
            .setLabel("Welcome Message")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("💬")
    );
    
    // Envia a mensagem com o embed e os botões
    const message = await interaction.editReply({
        embeds: [createSettingsEmbed()],
        components: [row1, row2, row3]
    });
    
    // Coletor para os botões
    const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 300000 // 5 minutos
    });
    
    collector.on("collect", async i => {
        await i.deferUpdate().catch(console.error);
        
        switch (i.customId) {
            case "ticket_toggle":
                // Alternar o status do sistema
                ticketData.enabled = !ticketData.enabled;
                saveGuildTickets(interaction.guild.id, ticketData);
                
                // Atualiza a mensagem
                row1.components[0].setLabel(ticketData.enabled ? "Disable System" : "Enable System")
                    .setStyle(ticketData.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(ticketData.enabled ? "🔴" : "🟢");
                
                await i.editReply({
                    embeds: [createSettingsEmbed()],
                    components: [row1, row2, row3]
                });
                break;
                
            case "ticket_category":
                // Obter categorias do servidor
                const categories = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
                
                if (categories.size === 0) {
                    return i.followUp({
                        content: "I couldn't find any categories on the server. Please create a category first.",
                        flags: MessageFlags.Ephemeral
                    });
                }
                
                // Prepara opções para o menu de seleção
                const categoryOptions = [];
                
                // Adiciona opção para criar nova categoria
                categoryOptions.push({
                    label: "✨ Create New Category",
                    description: "Creates a new category for tickets",
                    value: "new_category"
                });
                
                // Adiciona opção para remover categoria (se existir uma configurada)
                if (ticketData.categoryId) {
                    categoryOptions.push({
                        label: "❌ Remove Current Category",
                        description: "Removes the currently set category",
                        value: "remove_category"
                    });
                }
                
                // Adiciona todas as categorias existentes
                categories.forEach(category => {
                    categoryOptions.push({
                        label: category.name,
                        description: `ID: ${category.id}`,
                        value: category.id
                    });
                });
                
                // Cria o menu de seleção
                const categoryRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("ticket_category_select")
                        .setPlaceholder("Select a category")
                        .addOptions(categoryOptions)
                );
                
                // Envia o menu
                const categoryMsg = await i.followUp({
                    content: "Select the category where ticket channels will be created:",
                    components: [categoryRow],
                    flags: MessageFlags.Ephemeral
                });
                
                // Coletor para o menu
                const categoryCollector = categoryMsg.createMessageComponentCollector({
                    filter: i => i.user.id === interaction.user.id && i.customId === "ticket_category_select",
                    time: 60000, // 1 minuto
                    max: 1
                });
                
                categoryCollector.on("collect", async i => {
                    await i.deferUpdate();
                    
                    if (i.values[0] === "remove_category") {
                        // Remove a categoria
                        ticketData.categoryId = null;
                        saveGuildTickets(interaction.guild.id, ticketData);
                        
                        await i.editReply({
                            content: "✅ Ticket category removed successfully!",
                            components: []
                        });
                    }
                    else if (i.values[0] === "new_category") {
                        // Cria uma nova categoria
                        try {
                            const newCategory = await interaction.guild.channels.create({
                                name: "Tickets",
                                type: ChannelType.GuildCategory,
                                permissionOverwrites: [
                                    {
                                        id: interaction.guild.id, // @everyone
                                        deny: [PermissionFlagsBits.ViewChannel]
                                    },
                                    {
                                        id: interaction.client.user.id, // Bot
                                        allow: [
                                            PermissionFlagsBits.ViewChannel,
                                            PermissionFlagsBits.SendMessages,
                                            PermissionFlagsBits.ManageChannels,
                                            PermissionFlagsBits.ManageMessages
                                        ]
                                    }
                                ]
                            });
                            
                            // Define a nova categoria
                            ticketData.categoryId = newCategory.id;
                            saveGuildTickets(interaction.guild.id, ticketData);
                            
                            await i.editReply({
                                content: `✅ New category "${newCategory.name}" created and configured successfully!`,
                                components: []
                            });
                        } catch (error) {
                            console.error("Error creating category:", error);
                            
                            await i.editReply({
                                content: `❌ Error creating new category: ${error.message}`,
                                components: []
                            });
                        }
                    }
                    else {
                        // Define a categoria selecionada
                        ticketData.categoryId = i.values[0];
                        saveGuildTickets(interaction.guild.id, ticketData);
                        
                        const selectedCategory = interaction.guild.channels.cache.get(i.values[0]);
                        
                        await i.editReply({
                            content: `✅ Category "${selectedCategory.name}" configured successfully!`,
                            components: []
                        });
                    }
                    
                    // Atualiza a mensagem principal
                    await interaction.editReply({
                        embeds: [createSettingsEmbed()],
                        components: [row1, row2, row3]
                    });
                });
                
                categoryCollector.on("end", async (collected, reason) => {
                    if (reason === "time" && collected.size === 0) {
                        await categoryMsg.edit({
                            content: "⏱️ Time expired. No category was selected.",
                            components: []
                        });
                    }
                });
                break;
        }
    });
}

// Função alternativa para editar tipo sem usar modal
async function editTicketTypeAlternative(interaction, originalInteraction, ticketData, typeIndex) {
    const typeToEdit = ticketData.ticketTypes[typeIndex];
    
    // Envia mensagem solicitando os dados
    const promptMsg = await interaction.followUp({
        content: `**Edit Ticket Type: ${typeToEdit.emoji} ${typeToEdit.name}**\n\nAnswer the following questions to edit this ticket type.`,
        flags: MessageFlags.Ephemeral
    });
    
    // Estado para rastrear as respostas
    const responses = {
        id: typeToEdit.id,
        name: typeToEdit.name,
        emoji: typeToEdit.emoji,
        description: typeToEdit.description
    };
    
    // Função para criar o menu de cada etapa
    function createPromptMenu(step) {
        let content = `**Edit Ticket Type: ${typeToEdit.emoji} ${typeToEdit.name}**\n\n`;
        
        switch (step) {
            case 1:
                content += `**Step 1/4: Type ID**\nCurrent value: \`${typeToEdit.id}\`\nEnter the new unique ID for this ticket type (no spaces, example: 'support', 'bug', 'payment')`;
                break;
            case 2:
                content += `**Step 2/4: Type Name**\nCurrent value: \`${typeToEdit.name}\`\nEnter the new name that will be displayed for this ticket type`;
                break;
            case 3:
                content += `**Step 3/4: Type Emoji**\nCurrent value: ${typeToEdit.emoji}\nEnter the new emoji that will represent this ticket type`;
                break;
            case 4:
                content += `**Step 4/4: Type Description**\nCurrent value: \`${typeToEdit.description}\`\nEnter the new description for this ticket type`;
                break;
        }
        
        return content;
    }
    
    // Botões para cancelar ou pular etapas
    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_edit_skip")
            .setLabel("Keep Current Value")
            .setStyle(ButtonStyle.Primary)
            .setEmoji("⏭️"),
        new ButtonBuilder()
            .setCustomId("ticket_edit_cancel")
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("❌")
    );
    
    // Atualiza a mensagem para a primeira etapa
    await promptMsg.edit({
        content: createPromptMenu(1),
        components: [actionRow]
    });
    
    // Coletor para os botões
    const buttonCollector = promptMsg.createMessageComponentCollector({
        filter: i => i.user.id === originalInteraction.user.id && 
                    (i.customId === "ticket_edit_skip" || i.customId === "ticket_edit_cancel"),
        time: 300000 // 5 minutos
    });
    
    buttonCollector.on("collect", async i => {
        await i.deferUpdate().catch(console.error);
        
        if (i.customId === "ticket_edit_cancel") {
            await promptMsg.edit({
                content: "❌ Type editing process canceled.",
                components: []
            });
            
            buttonCollector.stop();
            messageCollector.stop("cancelled");
            return;
        }
        
        if (i.customId === "ticket_edit_skip") {
            // Avança para a próxima etapa
            currentStep++;
            
            if (currentStep > 4) {
                // Finaliza o processo
                messageCollector.stop("completed");
                return;
            }
            
            await promptMsg.edit({
                content: createPromptMenu(currentStep),
                components: [actionRow]
            });
        }
    });
    
    // Coletor para as mensagens
    const messageCollector = originalInteraction.channel.createMessageCollector({
        filter: m => m.author.id === originalInteraction.user.id,
        time: 300000 // 5 minutos
    });
    
    let currentStep = 1;
    
    messageCollector.on("collect", async message => {
        // Tenta deletar a mensagem para manter o chat limpo
        try {
            await message.delete().catch(() => {});
        } catch (error) {
            console.error("Could not delete message:", error);
        }
        
        // Processa a mensagem com base na etapa atual
        switch (currentStep) {
            case 1: // ID
                const id = message.content.trim().toLowerCase().replace(/\s+/g, "_");
                
                // Verifica se o ID já existe em outro tipo
                const idExists = ticketData.ticketTypes.some((type, index) => 
                    type.id === id && index !== typeIndex
                );
                
                if (idExists) {
                    await promptMsg.edit({
                        content: "❌ This ID is already used by another ticket type. Please choose a different ID.\n\n" + createPromptMenu(1),
                        components: [actionRow]
                    });
                    return;
                }
                
                responses.id = id;
                currentStep = 2;
                
                await promptMsg.edit({
                    content: createPromptMenu(2),
                    components: [actionRow]
                });
                break;
                
            case 2: // Nome
                responses.name = message.content.trim();
                currentStep = 3;
                
                await promptMsg.edit({
                    content: createPromptMenu(3),
                    components: [actionRow]
                });
                break;
                
            case 3: // Emoji
                responses.emoji = message.content.trim();
                currentStep = 4;
                
                await promptMsg.edit({
                    content: createPromptMenu(4),
                    components: [actionRow]
                });
                break;
                
            case 4: // Descrição
                responses.description = message.content.trim();
                
                // Finaliza o processo
                messageCollector.stop("completed");
                break;
        }
    });
    
    messageCollector.on("end", async (collected, reason) => {
        buttonCollector.stop();
        
        if (reason === "completed") {
            // Atualiza o tipo
            ticketData.ticketTypes[typeIndex] = {
                id: responses.id,
                name: responses.name,
                emoji: responses.emoji,
                description: responses.description
            };
            
            // Salva as alterações
            const success = saveGuildTickets(originalInteraction.guild.id, ticketData);
            
            if (success) {
                await promptMsg.edit({
                    content: `✅ Ticket type "${responses.emoji} ${responses.name}" updated successfully!`,
                    components: []
                });
                
                // Atualiza a exibição dos tipos
                await handleTicketTypes(originalInteraction, ticketData);
            } else {
                await promptMsg.edit({
                    content: "❌ An error occurred while saving the changes. Please try again.",
                    components: []
                });
            }
        } else if (reason === "time") {
            await promptMsg.edit({
                content: "⏱️ Time expired. The type editing process has been canceled.",
                components: []
            });
        } else if (reason !== "cancelled") {
            await promptMsg.edit({
                content: "❌ Type editing process canceled or interrupted.",
                components: []
            });
        }
    });
}

module.exports = command;