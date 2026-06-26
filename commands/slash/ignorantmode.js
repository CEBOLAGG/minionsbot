const { EmbedBuilder, Colors, MessageFlags } = require("discord.js");
const SlashCommand = require("../../lib/SlashCommand");
const { getIgnorantMode, setIgnorantMode } = require("../../util/guildDb");

const command = new SlashCommand()
    .setName("ignorantmode")
    .setDescription("Ativa/desativa o modo IA Ignorante neste canal (toggle)")
    .setRun(async (client, interaction, options) => {
        // Verifica se o usuário tem permissão de gerenciar mensagens
        if (!interaction.member.permissions.has("ManageMessages")) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setDescription("❌ Você precisa da permissão `Gerenciar Mensagens` para usar este comando."),
                ],
                flags: MessageFlags.Ephemeral,
            });
        }

        const guildId = interaction.guild.id;
        const channelId = interaction.channel.id;
        
        // Toggle do modo (agora async)
        const currentState = await getIgnorantMode(guildId, channelId);
        const newState = !currentState;
        
        await setIgnorantMode(guildId, channelId, newState);

        const embed = new EmbedBuilder()
            .setColor(newState ? 0xFF6B35 : 0x555555)
            .setTitle(newState ? "😤 Modo Ignorante ATIVADO" : "😴 Modo Ignorante DESATIVADO")
            .setDescription(
                newState
                    ? "Agora quando me marcarem neste canal, vou responder de forma IGNORANTE e CHATA! Preparem-se pra irritação! 🤬"
                    : "O modo ignorante foi desativado. Voltei a ser educado... por enquanto."
            )
            .setFooter({
                text: `Alterado por ${interaction.user.tag}`,
                iconURL: interaction.user.avatarURL(),
            })
            .setTimestamp();

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    });

module.exports = command;
