const SlashCommand = require("../../lib/SlashCommand");
const {EmbedBuilder, Colors, MessageFlags} = require("discord.js");

const command = new SlashCommand()
  .setName("testlavalink")
  .setDescription("Testa o sistema de monitoramento do Lavalink (apenas para administradores)")
  .setRun(async (client, interaction, options) => {
    let channel = client.getChannel(client, interaction);
    if (!channel) return;

    // Verificar se é o administrador
    if (interaction.user.id !== client.config.adminId) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Acesso Negado")
        .setDescription("Apenas o administrador do bot pode usar este comando.")
        .setColor("#FF0000")
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Verificar se o sistema de monitoramento está ativo
    if (!client.lavalinkMonitor) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Sistema de Monitoramento Desabilitado")
        .setDescription("O sistema de monitoramento do Lavalink não está ativo.")
        .setColor("#FF0000")
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // Simular um erro de conexão
      const testNode = {
        options: {
          identifier: "Test Node",
          host: "test.lavalink.server",
          port: 2333
        }
      };

      const testError = {
        message: "Unable to connect after 9999 attempts.. Connection refused"
      };

      // Enviar teste para o sistema de monitoramento
      await client.lavalinkMonitor.handleLavalinkEvent('nodeError', testNode, testError, 'Teste manual do sistema');

      const embed = new EmbedBuilder()
        .setTitle("✅ Teste Enviado")
        .setDescription("Um alerta de teste foi enviado para o webhook do Lavalink.")
        .setColor("#00FF00")
        .setTimestamp()
        .addFields("🔧 Detalhes do Teste", 
          `**Node:** ${testNode.options.identifier}\n` +
          `**Erro:** ${testError.message}\n` +
          `**Tipo:** nodeError\n` +
          `**Webhook:** ${client.config.lavalinkMonitoring.webhook.url ? "Configurado" : "Não configurado"}`,
          false
        );

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Erro no Teste")
        .setDescription(`Ocorreu um erro ao enviar o teste: ${error.message}`)
        .setColor("#FF0000")
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  });

module.exports = command;
