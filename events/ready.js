const { startBetSettlementLoop } = require("../util/BetSettlement");

/**
 * Ready event handler
 * @param {import("../lib/DiscordMusicBot")} client
 */
module.exports = async (client) => {
  // Inicializar o lavalink-client manager com o ID/username do cliente
  await client.manager.init({ id: client.user.id, username: client.user.username });

  // Feature de download: emojis da aplicacao + janitor do cache em memoria.
  try {
    const { ensureEmojis } = require("../lib/emojis");
    const { startCacheJanitor } = require("../lib/download/cache");
    await ensureEmojis(client);
    startCacheJanitor();
  } catch (e) {
    console.error("[startup] emojis/cache:", e?.message || e);
  }

  // Iniciar sistema de verificação de apostas (Minions Bet)
  startBetSettlementLoop(client, 5 * 60 * 1000); // Verifica a cada 5 minutos
  
  // Sistema de rotação de atividades a cada 5 segundos
  const activities = client.config.presence.activities || [];
  let currentActivityIndex = 0;
  
  // Função para atualizar o presence
  const updatePresence = () => {
    if (activities.length === 0) {
      // Se não houver atividades, usar o presence padrão
      client.user.setPresence(client.config.presence);
      return;
    }
    
    // Obter a atividade atual
    const activity = activities[currentActivityIndex];
    
    // Processar a atividade
    let activityName = activity.name;
    
    // Se a atividade tem uma função data, executá-la
    if (typeof activity.data === 'function') {
      try {
        const data = activity.data(client);
        // Se retornar um objeto com someVariable, substituir no nome
        if (data && typeof data === 'object' && data.someVariable !== undefined) {
          activityName = activityName.replace(/\{someVariable\}/g, data.someVariable);
        }
      } catch (error) {
        // Se houver erro ao executar a função, usar o nome padrão
        console.error('Error executing activity data function:', error);
      }
    }
    
    let activityData = {
      name: activityName,
      type: activity.type
    };
    
    // Se a atividade tem url (para STREAMING)
    if (activity.url) {
      activityData.url = activity.url;
    }
    
    // Atualizar o presence
    client.user.setPresence({
      status: client.config.presence.status || "online",
      activities: [activityData]
    });
    
    // Avançar para a próxima atividade
    currentActivityIndex = (currentActivityIndex + 1) % activities.length;
  };
  
  // Atualizar imediatamente
  updatePresence();
  
  // Atualizar a cada 5 segundos (5000ms)
  setInterval(updatePresence, 5000);
  
  client.log("Successfully Logged in as " + client.user.tag);
};
