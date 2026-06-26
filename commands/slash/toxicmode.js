const { EmbedBuilder, Colors, MessageFlags } = require("discord.js");
const SlashCommand = require("../../lib/SlashCommand");
const { getToxicMode, setToxicMode } = require("../../util/guildDb");

const command = new SlashCommand()
    .setName("toxicmode")
    .setDescription("Ativa/desativa o Modo Tóxico neste canal (toggle)")
    .setRun(async (client, interaction, options) => {
        // Precisa de permissão de gerenciar mensagens
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

        // Toggle do modo
        const currentState = await getToxicMode(guildId, channelId);
        const newState = !currentState;

        await setToxicMode(guildId, channelId, newState);

        const embed = new EmbedBuilder()
            .setColor(newState ? 0x8B0000 : 0x555555)
            .setTitle(newState ? "☣️ Modo Tóxico ATIVADO" : "🕊️ Modo Tóxico DESATIVADO")
            .setDescription(
                newState
                    ? "Modo tóxico ligado neste canal. Quando o toxix abrir a boca, eu humilho ele; e quando marcarem ele, já aviso que ele é um bosta. 💀"
                    : "Modo tóxico desativado. O toxix pode respirar aliviado... por enquanto."
            )
            .setFooter({
                text: `Alterado por ${interaction.user.tag}`,
                iconURL: interaction.user.avatarURL(),
            })
            .setTimestamp();

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    });

module.exports = command;
