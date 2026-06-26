const SlashCommand = require("../../lib/SlashCommand");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle, Colors } = require("discord.js");

const command = new SlashCommand()
    .setName("roleta")
    .setDescription("Cria uma roleta para selecionar alguém aleatoriamente")
    .addStringOption((option) =>
        option
            .setName("nomes")
            .setDescription("Lista de nomes separados por vírgula (opcional)")
            .setRequired(false)
    )
    .setRun(async (client, interaction) => {
        // Responde imediatamente para evitar timeout
        await interaction.deferReply();
        
        // Inicializa a roleta com os nomes fornecidos ou vazia
        const initialNames = interaction.options.getString("nomes");
        let names = [];
        
        if (initialNames) {
            names = initialNames.split(",").map(name => name.trim()).filter(name => name.length > 0);
        }
        
        // Objeto para armazenar o estado atual da roleta
        const roletaState = {
            names: names,
            spinning: false,
            winner: null,
            message: null,
            collector: null,
            timeout: null
        };
        
        // Função para criar o embed da roleta
        function createRoletaEmbed() {
            const embed = new EmbedBuilder()
                .setTitle("🎡 Roleta da Sorte 🎡")
                .setColor(client.config.embedColor);
            
            if (roletaState.spinning) {
                embed.setDescription("**A roleta está girando!**\n\n*Aguarde para ver quem será o escolhido...*");
                // Não mostra a lista durante o giro para criar suspense
            } else if (roletaState.winner) {
                embed.setDescription(`**🎉 O vencedor é: ${roletaState.winner} 🎉**`);
                embed.addFields("Participantes", names.join("\n") || "Nenhum participante", true);
            } else {
                embed.setDescription(
                    names.length > 0
                        ? "Adicione mais nomes à roleta e gire para escolher alguém aleatoriamente!"
                        : "Adicione nomes à roleta e gire para escolher alguém aleatoriamente!"
                );
                
                if (names.length > 0) {
                    embed.addFields("Participantes", names.join("\n"), true);
                }
            }
            
            // Adiciona uma imagem da roleta ou estatísticas
            if (names.length > 0) {
                embed.setFooter({ 
                    text: `Total de participantes: ${names.length} | Chance de cada um: ${(100 / names.length).toFixed(2)}%` 
                });
            } else {
                embed.setFooter({ text: "Adicione participantes para iniciar a roleta!" });
            }
            
            return embed;
        }
        
        // Função para criar os botões da roleta
        function createRoletaButtons(isSpinning = false) {
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("roleta_add")
                    .setLabel("Adicionar Nome")
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji("➕")
                    .setDisabled(isSpinning),
                new ButtonBuilder()
                    .setCustomId("roleta_spin")
                    .setLabel("Girar Roleta")
                    .setStyle(ButtonStyle.Success)
                    .setEmoji("🎯")
                    .setDisabled(isSpinning || names.length < 2)
            );
            
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("roleta_clear")
                    .setLabel("Limpar Todos")
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji("🗑️")
                    .setDisabled(isSpinning || names.length === 0),
                new ButtonBuilder()
                    .setCustomId("roleta_remove")
                    .setLabel("Remover Nome")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("➖")
                    .setDisabled(isSpinning || names.length === 0)
            );
            
            return [row1, row2];
        }
        
        // Função para simular o giro da roleta com uma animação
        async function spinRoleta() {
            if (names.length < 2) {
                return interaction.followUp({
                    content: "Adicione pelo menos 2 nomes para girar a roleta!",
                    ephemeral: true
                });
            }
            
            roletaState.spinning = true;
            roletaState.winner = null;
            
            // Atualiza a mensagem para mostrar que está girando
            await roletaState.message.edit({
                embeds: [createRoletaEmbed()],
                components: createRoletaButtons(true)
            });
            
            // Simula o giro com uma animação de "rolagem"
            const spinningTime = 3000; // Tempo de giro em ms
            const updateInterval = 250; // Intervalo de atualização em ms
            const totalUpdates = spinningTime / updateInterval;
            
            let currentUpdate = 0;
            let spinningEmbed = new EmbedBuilder()
                .setTitle("🎡 Roleta da Sorte 🎡")
                .setColor(client.config.embedColor)
                .setDescription("**A roleta está girando!**\n");
            
            const spinInterval = setInterval(async () => {
                currentUpdate++;
                
                // Escolhe um nome aleatório para mostrar durante o giro
                const randomIndex = Math.floor(Math.random() * names.length);
                const currentName = names[randomIndex];
                
                // Cria uma visualização animada da roleta
                let roletaVisual = "";
                for (let i = 0; i < names.length; i++) {
                    if (i === randomIndex) {
                        roletaVisual += `> 🎯 **${names[i]}** 🎯\n`;
                    } else {
                        roletaVisual += `> ${names[i]}\n`;
                    }
                }
                
                // Atualiza o embed com a visualização atual
                spinningEmbed.setDescription(
                    `**A roleta está girando!**\n\n${roletaVisual}\n*Escolhendo...*`
                );
                
                // Adiciona um indicador de progresso
                const progressBar = "🟦".repeat(Math.floor(currentUpdate / totalUpdates * 10)) + 
                                   "⬜".repeat(10 - Math.floor(currentUpdate / totalUpdates * 10));
                
                spinningEmbed.setFooter({ 
                    text: `Progresso: ${progressBar} ${Math.floor(currentUpdate / totalUpdates * 100)}%` 
                });
                
                // Atualiza a mensagem com o novo estado da roleta
                await roletaState.message.edit({ embeds: [spinningEmbed] });
                
                // Quando terminar o giro, escolhe o vencedor
                if (currentUpdate >= totalUpdates) {
                    clearInterval(spinInterval);
                    
                    // Escolhe o vencedor final
                    const winnerIndex = Math.floor(Math.random() * names.length);
                    roletaState.winner = names[winnerIndex];
                    roletaState.spinning = false;
                    
                    // Cria um embed especial para o vencedor
                    const winnerEmbed = new EmbedBuilder()
                        .setTitle("🎡 Roleta da Sorte 🎡")
                        .setColor("#FFD700") // Dourado para o vencedor
                        .setDescription(`**🎉 O vencedor é: ${roletaState.winner} 🎉**`)
                        .addFields("Participantes", names.join("\n"), true)
                        .setFooter({ 
                            text: `Total de participantes: ${names.length} | Chance: ${(100 / names.length).toFixed(2)}%` 
                        });
                    
                    // Adiciona um efeito visual para destacar o vencedor
                    let winnerAnnouncementText = "";
                    for (let i = 0; i < names.length; i++) {
                        if (i === winnerIndex) {
                            winnerAnnouncementText += `> 🏆 **${names[i]}** 🏆\n`;
                        } else {
                            winnerAnnouncementText += `> ${names[i]}\n`;
                        }
                    }
                    
                    winnerEmbed.setDescription(
                        `**🎉 TEMOS UM VENCEDOR! 🎉**\n\n${winnerAnnouncementText}\n` +
                        `**Parabéns, ${roletaState.winner}!**`
                    );
                    
                    // Atualiza a mensagem com o resultado final
                    await roletaState.message.edit({
                        embeds: [winnerEmbed],
                        components: createRoletaButtons()
                    });
                }
            }, updateInterval);
        }
        
        // Função para adicionar um nome à roleta
        async function addNameToRoleta(user) {
            // Cria um modal para o usuário digitar o nome
            const modal = {
                title: "Adicionar Nome à Roleta",
                custom_id: "roleta_add_modal",
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 4,
                                custom_id: "roleta_name_input",
                                label: "Nome para adicionar",
                                style: 1,
                                min_length: 1,
                                max_length: 100,
                                placeholder: "Digite um nome para adicionar à roleta",
                                required: true
                            }
                        ]
                    }
                ]
            };
            
            try {
                // Tenta mostrar o modal
                await interaction.showModal(modal);
            } catch (error) {
                // Se não conseguir usar modal (versão mais antiga do Discord.js), usa um seguimento de mensagem
                console.error("Modal not supported, using follow-up message:", error);
                
                const followUp = await interaction.followUp({
                    content: "Digite o nome que deseja adicionar à roleta (envie uma mensagem no canal):",
                    ephemeral: true
                });
                
                // Cria um coletor de mensagens para o usuário digitar o nome
                const filter = m => m.author.id === user.id;
                const nameCollector = interaction.channel.createMessageCollector({ 
                    filter, 
                    time: 30000,
                    max: 1
                });
                
                nameCollector.on('collect', async msg => {
                    // Adiciona o nome à roleta
                    const newName = msg.content.trim();
                    if (newName && newName.length > 0) {
                        names.push(newName);
                        
                        // Atualiza a mensagem da roleta
                        await roletaState.message.edit({
                            embeds: [createRoletaEmbed()],
                            components: createRoletaButtons()
                        });
                        
                        // Confirma a adição
                        await followUp.edit({
                            content: `✅ Nome "${newName}" adicionado à roleta!`,
                            ephemeral: true
                        });
                        
                        // Tenta excluir a mensagem do usuário para manter o chat limpo
                        try {
                            await msg.delete();
                        } catch (err) {
                            // Ignora se não tiver permissão para excluir
                        }
                    }
                });
                
                nameCollector.on('end', async (collected, reason) => {
                    if (reason === 'time' && collected.size === 0) {
                        await followUp.edit({
                            content: "⏱️ Tempo esgotado. Nenhum nome foi adicionado.",
                            ephemeral: true
                        });
                    }
                });
            }
        }
        
        // Função para remover um nome da roleta
        async function removeNameFromRoleta() {
            if (names.length === 0) {
                return interaction.followUp({
                    content: "Não há nomes para remover da roleta!",
                    ephemeral: true
                });
            }
            
            // Cria um menu de seleção com os nomes atuais
            const options = names.map((name, index) => ({
                label: name.length > 25 ? name.substring(0, 22) + "..." : name,
                description: `Remover "${name}" da roleta`,
                value: index.toString()
            }));
            
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("roleta_remove_select")
                    .setPlaceholder("Selecione um nome para remover")
                    .addOptions(options)
            );
            
            // Envia o menu de seleção como uma mensagem de seguimento
            const removeMessage = await interaction.followUp({
                content: "Selecione o nome que deseja remover da roleta:",
                components: [row],
                ephemeral: true
            });
            
            // Cria um coletor para o menu de seleção
            const filter = i => i.customId === "roleta_remove_select" && i.user.id === interaction.user.id;
            const collector = removeMessage.createMessageComponentCollector({ 
                filter, 
                time: 30000,
                max: 1
            });
            
            collector.on('collect', async i => {
                // Obtém o índice do nome selecionado
                const selectedIndex = parseInt(i.values[0]);
                const removedName = names[selectedIndex];
                
                // Remove o nome da roleta
                names.splice(selectedIndex, 1);
                
                // Atualiza a mensagem da roleta
                await roletaState.message.edit({
                    embeds: [createRoletaEmbed()],
                    components: createRoletaButtons()
                });
                
                // Confirma a remoção
                await i.update({
                    content: `✅ Nome "${removedName}" removido da roleta!`,
                    components: []
                });
            });
            
            collector.on('end', async (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    await removeMessage.edit({
                        content: "⏱️ Tempo esgotado. Nenhum nome foi removido.",
                        components: []
                    });
                }
            });
        }
        
        // Envia a mensagem inicial da roleta
        roletaState.message = await interaction.editReply({
            embeds: [createRoletaEmbed()],
            components: createRoletaButtons()
        });
        
        // Cria um coletor para os botões da roleta
        const filter = i => i.customId.startsWith("roleta_") && i.user.id === interaction.user.id;
        roletaState.collector = interaction.channel.createMessageComponentCollector({ 
            filter, 
            time: 300000 // 5 minutos
        });
        
        // Processa as interações com os botões
        roletaState.collector.on('collect', async i => {
            // Responde imediatamente para evitar erros de interação
            await i.deferUpdate().catch(() => {});
            
            // Processa a interação com base no botão clicado
            switch (i.customId) {
                case "roleta_add":
                    // Adiciona um nome à roleta
                    await addNameToRoleta(i.user);
                    break;
                    
                case "roleta_spin":
                    // Gira a roleta
                    await spinRoleta();
                    break;
                    
                case "roleta_clear":
                    // Limpa todos os nomes da roleta
                    names = [];
                    roletaState.winner = null;
                    
                    // Atualiza a mensagem da roleta
                    await roletaState.message.edit({
                        embeds: [createRoletaEmbed()],
                        components: createRoletaButtons()
                    });
                    break;
                    
                case "roleta_remove":
                    // Remove um nome da roleta
                    await removeNameFromRoleta();
                    break;
                    
                case "roleta_remove_select":
                    // Este caso é tratado pelo coletor específico do menu de seleção
                    break;
            }
        });
        
        // Processa o envio do modal para adicionar nome
        interaction.client.on('interactionCreate', async interaction => {
            if (!interaction.isModalSubmit()) return;
            if (interaction.customId !== "roleta_add_modal") return;
            
            // Obtém o nome digitado no modal
            const name = interaction.fields.getTextInputValue("roleta_name_input");
            
            // Adiciona o nome à roleta
            if (name && name.length > 0) {
                names.push(name);
                
                // Atualiza a mensagem da roleta
                await roletaState.message.edit({
                    embeds: [createRoletaEmbed()],
                    components: createRoletaButtons()
                });
                
                // Confirma a adição
                await interaction.reply({
                    content: `✅ Nome "${name}" adicionado à roleta!`,
                    ephemeral: true
                });
            }
        });
        
        // Finaliza o coletor após o tempo limite
        roletaState.collector.on('end', async () => {
            // Desativa todos os botões
            const disabledButtons = createRoletaButtons().map(row => {
                const newRow = new ActionRowBuilder();
                row.components.forEach(button => {
                    newRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(button.customId)
                            .setLabel(button.label)
                            .setStyle(button.style)
                            .setEmoji(button.emoji)
                            .setDisabled(true)
                    );
                });
                return newRow;
            });
            
            // Atualiza o embed com uma mensagem de encerramento
            const finalEmbed = createRoletaEmbed();
            finalEmbed.setFooter({ 
                text: `Roleta encerrada | ${finalEmbed.footer.text}` 
            });
            
            // Atualiza a mensagem final
            await roletaState.message.edit({
                embeds: [finalEmbed],
                components: disabledButtons
            }).catch(() => {});
        });
    });

module.exports = command;