// sharp é carregado preguiçosamente (só ao subir os emojis).

/**
 * Icones monocromaticos (Lucide, ISC) + status dots, usados na feature de download
 * E na UI de musica (controles/filtros/status). No startup o bot rasteriza os SVGs
 * (sharp) e sobe como EMOJIS DA APLICACAO (idempotente). Prefixo "mb_".
 *
 * Use emojiFor(key) em botoes (.setEmoji) e emojiTag(key) em texto/embeds.
 * Gerado por scripts; para regenerar, rode o gerador de emojis.
 */

const COLOR = "#f2f3f5";

const SVGS = {
  "video": "<svg class=\"lucide lucide-film\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /><path d=\"M7 3v18\" /><path d=\"M3 7.5h4\" /><path d=\"M3 12h18\" /><path d=\"M3 16.5h4\" /><path d=\"M17 3v18\" /><path d=\"M17 7.5h4\" /><path d=\"M17 16.5h4\" /></svg>",
  "audio": "<svg class=\"lucide lucide-music\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 18V5l12-2v13\" /><circle cx=\"6\" cy=\"18\" r=\"3\" /><circle cx=\"18\" cy=\"16\" r=\"3\" /></svg>",
  "download": "<svg class=\"lucide lucide-download\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg>",
  "media": "<svg class=\"lucide lucide-circle-arrow-down\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M12 8v8\" /><path d=\"m8 12 4 4 4-4\" /></svg>",
  "error": "<svg class=\"lucide lucide-circle-x\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m15 9-6 6\" /><path d=\"m9 9 6 6\" /></svg>",
  "gallery": "<svg class=\"lucide lucide-images\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m22 11-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16\" /><path d=\"M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2\" /><circle cx=\"13\" cy=\"7\" r=\"1\" fill=\"currentColor\" /><rect x=\"8\" y=\"2\" width=\"14\" height=\"14\" rx=\"2\" /></svg>",
  "link": "<svg class=\"lucide lucide-link\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\" /><path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\" /></svg>",
  "expired": "<svg class=\"lucide lucide-clock\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M12 6v6l4 2\" /></svg>",
  "success": "<svg class=\"lucide lucide-circle-check\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"m9 12 2 2 4-4\" /></svg>",
  "file": "<svg class=\"lucide lucide-file\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" /><path d=\"M14 2v5a1 1 0 0 0 1 1h5\" /></svg>",
  "play": "<svg class=\"lucide lucide-play\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z\" /></svg>",
  "pause": "<svg class=\"lucide lucide-pause\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"14\" y=\"3\" width=\"5\" height=\"18\" rx=\"1\" /><rect x=\"5\" y=\"3\" width=\"5\" height=\"18\" rx=\"1\" /></svg>",
  "resume": "<svg class=\"lucide lucide-circle-play\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z\" /><circle cx=\"12\" cy=\"12\" r=\"10\" /></svg>",
  "stop": "<svg class=\"lucide lucide-square\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /></svg>",
  "skip": "<svg class=\"lucide lucide-skip-forward\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 4v16\" /><path d=\"M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z\" /></svg>",
  "previous": "<svg class=\"lucide lucide-skip-back\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z\" /><path d=\"M3 20V4\" /></svg>",
  "forward": "<svg class=\"lucide lucide-fast-forward\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 6a2 2 0 0 1 3.414-1.414l6 6a2 2 0 0 1 0 2.828l-6 6A2 2 0 0 1 12 18z\" /><path d=\"M2 6a2 2 0 0 1 3.414-1.414l6 6a2 2 0 0 1 0 2.828l-6 6A2 2 0 0 1 2 18z\" /></svg>",
  "shuffle": "<svg class=\"lucide lucide-shuffle\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m18 14 4 4-4 4\" /><path d=\"m18 2 4 4-4 4\" /><path d=\"M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22\" /><path d=\"M2 6h1.972a4 4 0 0 1 3.6 2.2\" /><path d=\"M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45\" /></svg>",
  "loop": "<svg class=\"lucide lucide-repeat\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m17 2 4 4-4 4\" /><path d=\"M3 11v-1a4 4 0 0 1 4-4h14\" /><path d=\"m7 22-4-4 4-4\" /><path d=\"M21 13v1a4 4 0 0 1-4 4H3\" /></svg>",
  "loopone": "<svg class=\"lucide lucide-repeat-1\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m17 2 4 4-4 4\" /><path d=\"M3 11v-1a4 4 0 0 1 4-4h14\" /><path d=\"m7 22-4-4 4-4\" /><path d=\"M21 13v1a4 4 0 0 1-4 4H3\" /><path d=\"M11 10h1v4\" /></svg>",
  "navleft": "<svg class=\"lucide lucide-chevron-left\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m15 18-6-6 6-6\" /></svg>",
  "navright": "<svg class=\"lucide lucide-chevron-right\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m9 18 6-6-6-6\" /></svg>",
  "chevdown": "<svg class=\"lucide lucide-chevron-down\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 9 6 6 6-6\" /></svg>",
  "chevup": "<svg class=\"lucide lucide-chevron-up\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m18 15-6-6-6 6\" /></svg>",
  "search": "<svg class=\"lucide lucide-search\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m21 21-4.34-4.34\" /><circle cx=\"11\" cy=\"11\" r=\"8\" /></svg>",
  "pin": "<svg class=\"lucide lucide-pin\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 17v5\" /><path d=\"M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z\" /></svg>",
  "trash": "<svg class=\"lucide lucide-trash-2\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10 11v6\" /><path d=\"M14 11v6\" /><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\" /><path d=\"M3 6h18\" /><path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\" /></svg>",
  "plus": "<svg class=\"lucide lucide-plus\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 12h14\" /><path d=\"M12 5v14\" /></svg>",
  "minus": "<svg class=\"lucide lucide-minus\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 12h14\" /></svg>",
  "queue": "<svg class=\"lucide lucide-list-music\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M16 5H3\" /><path d=\"M11 12H3\" /><path d=\"M11 19H3\" /><path d=\"M21 16V5\" /><circle cx=\"18\" cy=\"16\" r=\"3\" /></svg>",
  "warn": "<svg class=\"lucide lucide-triangle-alert\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\" /><path d=\"M12 9v4\" /><path d=\"M12 17h.01\" /></svg>",
  "zap": "<svg class=\"lucide lucide-zap\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z\" /></svg>",
  "live": "<svg class=\"lucide lucide-radio\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M16.247 7.761a6 6 0 0 1 0 8.478\" /><path d=\"M19.075 4.933a10 10 0 0 1 0 14.134\" /><path d=\"M4.925 19.067a10 10 0 0 1 0-14.134\" /><path d=\"M7.753 16.239a6 6 0 0 1 0-8.478\" /><circle cx=\"12\" cy=\"12\" r=\"2\" /></svg>",
  "stats": "<svg class=\"lucide lucide-bar-chart-3\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 3v16a2 2 0 0 0 2 2h16\" /><path d=\"M18 17V9\" /><path d=\"M13 17V5\" /><path d=\"M8 17v-3\" /></svg>",
  "monitor": "<svg class=\"lucide lucide-monitor\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect width=\"20\" height=\"14\" x=\"2\" y=\"3\" rx=\"2\" /><line x1=\"8\" x2=\"16\" y1=\"21\" y2=\"21\" /><line x1=\"12\" x2=\"12\" y1=\"17\" y2=\"21\" /></svg>",
  "settings": "<svg class=\"lucide lucide-settings\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\" /><circle cx=\"12\" cy=\"12\" r=\"3\" /></svg>",
  "filters": "<svg class=\"lucide lucide-sliders-horizontal\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10 5H3\" /><path d=\"M12 19H3\" /><path d=\"M14 3v4\" /><path d=\"M16 17v4\" /><path d=\"M21 12h-9\" /><path d=\"M21 19h-5\" /><path d=\"M21 5h-7\" /><path d=\"M8 10v4\" /><path d=\"M8 12H3\" /></svg>",
  "vol2": "<svg class=\"lucide lucide-volume-2\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z\" /><path d=\"M16 9a5 5 0 0 1 0 6\" /><path d=\"M19.364 18.364a9 9 0 0 0 0-12.728\" /></svg>",
  "vol1": "<svg class=\"lucide lucide-volume-1\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z\" /><path d=\"M16 9a5 5 0 0 1 0 6\" /></svg>",
  "vol0": "<svg class=\"lucide lucide-volume-x\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z\" /><line x1=\"22\" x2=\"16\" y1=\"9\" y2=\"15\" /><line x1=\"16\" x2=\"22\" y1=\"9\" y2=\"15\" /></svg>",
  "waves": "<svg class=\"lucide lucide-waves\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 12q2.5 2 5 0t5 0 5 0 5 0\" /><path d=\"M2 19q2.5 2 5 0t5 0 5 0 5 0\" /><path d=\"M2 5q2.5 2 5 0t5 0 5 0 5 0\" /></svg>",
  "slow": "<svg class=\"lucide lucide-snail\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 13a6 6 0 1 0 12 0 4 4 0 1 0-8 0 2 2 0 0 0 4 0\" /><circle cx=\"10\" cy=\"13\" r=\"8\" /><path d=\"M2 21h12c4.4 0 8-3.6 8-8V7a2 2 0 1 0-4 0v6\" /><path d=\"M18 3 19.1 5.2\" /><path d=\"M22 3 20.9 5.2\" /></svg>",
  "micvocal": "<svg class=\"lucide lucide-mic-vocal\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12\" /><path d=\"M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5\" /><circle cx=\"16\" cy=\"7\" r=\"5\" /></svg>",
  "mic": "<svg class=\"lucide lucide-mic\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 19v3\" /><path d=\"M19 10v2a7 7 0 0 1-14 0v-2\" /><rect x=\"9\" y=\"2\" width=\"6\" height=\"13\" rx=\"3\" /></svg>",
  "vibrate": "<svg class=\"lucide lucide-vibrate\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m2 8 2 2-2 2 2 2-2 2\" /><path d=\"m22 8-2 2 2 2-2 2 2 2\" /><rect width=\"8\" height=\"14\" x=\"8\" y=\"5\" rx=\"1\" /></svg>",
  "guitar": "<svg class=\"lucide lucide-guitar\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m11.9 12.1 4.514-4.514\" /><path d=\"M20.1 2.3a1 1 0 0 0-1.4 0l-1.114 1.114A2 2 0 0 0 17 4.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 17.828 7h1.344a2 2 0 0 0 1.414-.586L21.7 5.3a1 1 0 0 0 0-1.4z\" /><path d=\"m6 16 2 2\" /><path d=\"M8.23 9.85A3 3 0 0 1 11 8a5 5 0 0 1 5 5 3 3 0 0 1-1.85 2.77l-.92.38A2 2 0 0 0 12 18a4 4 0 0 1-4 4 6 6 0 0 1-6-6 4 4 0 0 1 4-4 2 2 0 0 0 1.85-1.23z\" /></svg>",
  "door": "<svg class=\"lucide lucide-door-open\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M11 20H2\" /><path d=\"M11 4.562v16.157a1 1 0 0 0 1.242.97L19 20V5.562a2 2 0 0 0-1.515-1.94l-4-1A2 2 0 0 0 11 4.561z\" /><path d=\"M11 4H8a2 2 0 0 0-2 2v14\" /><path d=\"M14 12h.01\" /><path d=\"M22 20h-3\" /></svg>",
  "wrench": "<svg class=\"lucide lucide-wrench\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z\" /></svg>",
  "home": "<svg class=\"lucide lucide-house\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\" /><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\" /></svg>",
  "away": "<svg class=\"lucide lucide-plane\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z\" /></svg>",
  "draw": "<svg class=\"lucide lucide-handshake\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m11 17 2 2a1 1 0 1 0 3-3\" /><path d=\"m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4\" /><path d=\"m21 3 1 11h-2\" /><path d=\"M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3\" /><path d=\"M3 4h8\" /></svg>",
  "trophy": "<svg class=\"lucide lucide-trophy\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978\" /><path d=\"M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978\" /><path d=\"M18 9h1.5a1 1 0 0 0 0-5H18\" /><path d=\"M4 22h16\" /><path d=\"M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z\" /><path d=\"M6 9H4.5a1 1 0 0 1 0-5H6\" /></svg>",
  "coins": "<svg class=\"lucide lucide-coins\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M13.744 17.736a6 6 0 1 1-7.48-7.48\" /><path d=\"M15 6h1v4\" /><path d=\"m6.134 14.768.866-.5 2 3.464\" /><circle cx=\"16\" cy=\"8\" r=\"6\" /></svg>",
  "dice": "<svg class=\"lucide lucide-dices\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect width=\"12\" height=\"12\" x=\"2\" y=\"10\" rx=\"2\" ry=\"2\" /><path d=\"m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6\" /><path d=\"M6 18h.01\" /><path d=\"M10 14h.01\" /><path d=\"M15 6h.01\" /><path d=\"M18 9h.01\" /></svg>",
  "calendar": "<svg class=\"lucide lucide-calendar\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 2v4\" /><path d=\"M16 2v4\" /><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\" /><path d=\"M3 10h18\" /></svg>",
  "target": "<svg class=\"lucide lucide-target\" xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\" /><circle cx=\"12\" cy=\"12\" r=\"6\" /><circle cx=\"12\" cy=\"12\" r=\"2\" /></svg>",
  "green": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"7\" fill=\"#43b581\"/></svg>",
  "yellow": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"7\" fill=\"#faa61a\"/></svg>",
  "red": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"7\" fill=\"#f04747\"/></svg>"
};

const NAMES = {
  "video": "mb_video",
  "audio": "mb_audio",
  "download": "mb_download",
  "media": "mb_media",
  "error": "mb_error",
  "gallery": "mb_gallery",
  "link": "mb_link",
  "expired": "mb_expired",
  "success": "mb_success",
  "file": "mb_file",
  "play": "mb_play",
  "pause": "mb_pause",
  "resume": "mb_resume",
  "stop": "mb_stop",
  "skip": "mb_skip",
  "previous": "mb_previous",
  "forward": "mb_forward",
  "shuffle": "mb_shuffle",
  "loop": "mb_loop",
  "loopone": "mb_loopone",
  "navleft": "mb_navleft",
  "navright": "mb_navright",
  "chevdown": "mb_chevdown",
  "chevup": "mb_chevup",
  "search": "mb_search",
  "pin": "mb_pin",
  "trash": "mb_trash",
  "plus": "mb_plus",
  "minus": "mb_minus",
  "queue": "mb_queue",
  "warn": "mb_warn",
  "zap": "mb_zap",
  "live": "mb_live",
  "stats": "mb_stats",
  "monitor": "mb_monitor",
  "settings": "mb_settings",
  "filters": "mb_filters",
  "vol2": "mb_vol2",
  "vol1": "mb_vol1",
  "vol0": "mb_vol0",
  "waves": "mb_waves",
  "slow": "mb_slow",
  "micvocal": "mb_micvocal",
  "mic": "mb_mic",
  "vibrate": "mb_vibrate",
  "guitar": "mb_guitar",
  "door": "mb_door",
  "wrench": "mb_wrench",
  "home": "mb_home",
  "away": "mb_away",
  "draw": "mb_draw",
  "trophy": "mb_trophy",
  "coins": "mb_coins",
  "dice": "mb_dice",
  "calendar": "mb_calendar",
  "target": "mb_target",
  "green": "mb_green",
  "yellow": "mb_yellow",
  "red": "mb_red"
};

const FALLBACK = {
  "video": "🎬",
  "audio": "🎵",
  "download": "⬇️",
  "media": "📥",
  "error": "❌",
  "gallery": "🖼️",
  "link": "🔗",
  "expired": "⏳",
  "success": "✅",
  "file": "📁",
  "play": "▶️",
  "pause": "⏸️",
  "resume": "⏯️",
  "stop": "⏹️",
  "skip": "⏭️",
  "previous": "⏮️",
  "forward": "⏩",
  "shuffle": "🔀",
  "loop": "🔁",
  "loopone": "🔂",
  "navleft": "◀️",
  "navright": "▶️",
  "chevdown": "🔽",
  "chevup": "🔼",
  "search": "🔍",
  "pin": "📌",
  "trash": "🗑️",
  "plus": "➕",
  "minus": "➖",
  "queue": "📋",
  "warn": "⚠️",
  "zap": "⚡",
  "live": "🔴",
  "stats": "📊",
  "monitor": "🖥️",
  "settings": "⚙️",
  "filters": "🎛️",
  "vol2": "🔊",
  "vol1": "🔉",
  "vol0": "🔈",
  "waves": "🌊",
  "slow": "🐌",
  "micvocal": "🎤",
  "mic": "🎙️",
  "vibrate": "📳",
  "guitar": "🎸",
  "door": "🚪",
  "wrench": "🔧",
  "home": "🏠",
  "away": "✈️",
  "draw": "🤝",
  "trophy": "🏆",
  "coins": "🪙",
  "dice": "🎲",
  "calendar": "📅",
  "target": "🎯",
  "green": "🟢",
  "yellow": "🟡",
  "red": "🔴"
};

const cache = {}; // key -> { id, name }

async function toPng(svg) {
  const sharp = require("sharp");
  const colored = svg.replace(/currentColor/g, COLOR).replace(/stroke-width="2"/g, 'stroke-width="2.25"');
  return sharp(Buffer.from(colored), { density: 384 })
    .resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/** Permite outras partes registrarem icones extras antes do ensureEmojis. */
function registerIcons({ svgs = {}, names = {}, fallback = {} } = {}) {
  Object.assign(SVGS, svgs);
  Object.assign(NAMES, names);
  Object.assign(FALLBACK, fallback);
}

/** Sobe (idempotente) todos os emojis da aplicacao. Chamar UMA vez no ready. */
async function ensureEmojis(client) {
  try {
    const existing = await client.application.emojis.fetch();
    const byName = new Map(existing.map((e) => [e.name, e]));
    let created = 0;
    for (const [key, name] of Object.entries(NAMES)) {
      let emoji = byName.get(name);
      if (!emoji) {
        emoji = await client.application.emojis.create({ attachment: await toPng(SVGS[key]), name });
        created++;
      }
      cache[key] = { id: emoji.id, name };
    }
    console.log(`[emojis] ✅ ${Object.keys(NAMES).length} icones custom prontos (${created} criado(s) agora).`);
  } catch (err) {
    console.warn("[emojis] ⚠️ Nao consegui preparar os icones (usando fallback):", err?.message || err);
  }
}

/** Resolvable para ButtonBuilder/SelectMenuOption.setEmoji (custom se pronto, senao unicode). */
function emojiFor(key) {
  return cache[key] ? { id: cache[key].id, name: cache[key].name } : FALLBACK[key];
}

/** Forma textual <:name:id> para texto/embeds (senao unicode). */
function emojiTag(key) {
  return cache[key] ? `<:${cache[key].name}:${cache[key].id}>` : (FALLBACK[key] || "");
}

module.exports = { ensureEmojis, emojiFor, emojiTag, registerIcons };
