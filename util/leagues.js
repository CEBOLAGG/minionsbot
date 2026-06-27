/**
 * Lista ÚNICA de ligas de futebol (id da ESPN -> { name, priority, emoji, oddsKey }).
 *
 * Compartilhada entre o board do /minionsbet e o handler do modal de aposta
 * (events/interactionCreate.js) pra NUNCA divergirem. Antes cada arquivo tinha sua
 * própria lista; quando o board ganhava uma liga nova (ex.: Mundial de Clubes, Copa
 * do Mundo, amistosos) e o modal não, dava "jogo não encontrado" ao apostar.
 */
const LEAGUES = {
    "bra.1": { name: "Brasileirão Série A", priority: 100, emoji: "🇧🇷", oddsKey: "soccer_brazil_campeonato" },
    "bra.2": { name: "Brasileirão Série B", priority: 90, emoji: "🇧🇷", oddsKey: "soccer_brazil_serie_b" },
    "bra.3": { name: "Brasileirão Série C", priority: 85, emoji: "🇧🇷", oddsKey: null },
    "bra.copa_do_brazil": { name: "Copa do Brasil", priority: 95, emoji: "🇧🇷🏆", oddsKey: null },
    "eng.1": { name: "Premier League", priority: 98, emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", oddsKey: "soccer_epl" },
    "esp.1": { name: "La Liga", priority: 97, emoji: "🇪🇸", oddsKey: "soccer_spain_la_liga" },
    "ita.1": { name: "Serie A", priority: 96, emoji: "🇮🇹", oddsKey: "soccer_italy_serie_a" },
    "ger.1": { name: "Bundesliga", priority: 95, emoji: "🇩🇪", oddsKey: "soccer_germany_bundesliga" },
    "fra.1": { name: "Ligue 1", priority: 94, emoji: "🇫🇷", oddsKey: "soccer_france_ligue_one" },
    "uefa.champions": { name: "Champions League", priority: 110, emoji: "🏆", oddsKey: "soccer_uefa_champs_league" },
    "uefa.europa": { name: "Europa League", priority: 105, emoji: "🏆", oddsKey: "soccer_uefa_europa_league" },
    "fifa.world": { name: "Copa do Mundo FIFA", priority: 130, emoji: "🌍🏆", oddsKey: "soccer_fifa_world_cup" },
    "fifa.friendly": { name: "Amistosos de Seleções", priority: 70, emoji: "🌍", oddsKey: null },
    "fifa.cwc": { name: "Mundial de Clubes", priority: 115, emoji: "🌍", oddsKey: null },
    "fifa.intercontinental_cup": { name: "Copa Intercontinental", priority: 112, emoji: "🌍🏆", oddsKey: null },
    "conmebol.libertadores": { name: "Copa Libertadores", priority: 108, emoji: "🏆", oddsKey: "soccer_conmebol_copa_libertadores" },
    "conmebol.sudamericana": { name: "Copa Sul-Americana", priority: 103, emoji: "🏆", oddsKey: null },
    "arg.1": { name: "Primera División (ARG)", priority: 85, emoji: "🇦🇷", oddsKey: "soccer_argentina_primera_division" },
    "mex.1": { name: "Liga MX", priority: 80, emoji: "🇲🇽", oddsKey: "soccer_mexico_ligamx" },
    "por.1": { name: "Primeira Liga", priority: 88, emoji: "🇵🇹", oddsKey: "soccer_portugal_primeira_liga" },
};

module.exports = { LEAGUES };
