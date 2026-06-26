const { EmbedBuilder, Colors, MessageFlags } = require("discord.js");
const SlashCommand = require("../../lib/SlashCommand");
const { getVnwMode, setVnwMode } = require("../../util/guildDb");

const command = new SlashCommand()
    .setName("vnwmode")
    .setDescription("Ativa/desativa o modo VNW neste canal (toggle)")
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
        const currentState = await getVnwMode(guildId, channelId);
        const newState = !currentState;
        
        await setVnwMode(guildId, channelId, newState);

        const embed = new EmbedBuilder()
            .setColor(newState ? 0x00FF00 : 0xFF0000)
            .setTitle(newState ? "✅ VNW Mode Ativado" : "❌ VNW Mode Desativado")
            .setDescription(
                newState
                    ? "Agora quando me marcarem neste canal e mencionarem **VNW** ou **Brayhax**, vou responder de acordo! 😈"
                    : "O modo VNW foi desativado neste canal."
            )
            .setFooter({
                text: `Alterado por ${interaction.user.tag}`,
                iconURL: interaction.user.avatarURL(),
            })
            .setTimestamp();

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    });

module.exports = command;
