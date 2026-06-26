/**
 * Get a connected Lavalink node
 * @param {import("../lib/DiscordMusicBot")} client
 * @returns {Promise<Object | undefined>}
 */
module.exports = async (client) => {
  // lavalink-client: os nodes ficam em client.manager.nodeManager.nodes (Map de id->node)
  const nm = client.manager?.nodeManager;
  if (!nm || !nm.nodes) return undefined;

  // Retorna o 1o node conectado
  for (const node of nm.nodes.values()) {
    if (node.connected) return node;
  }

  // Se nenhum estiver conectado, retorna o 1o disponivel
  return nm.nodes.values().next().value;
};
