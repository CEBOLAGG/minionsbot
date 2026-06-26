/**
 * O cobalt e um downloader, nao uma API de metadados: respostas de midia unica
 * (tunnel/redirect) trazem so url + filename, sem thumbnail. Entao derivamos a
 * thumbnail por conta propria.
 */

const YT_PATTERNS = [
  /youtu\.be\/([\w-]{11})/,
  /youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)([\w-]{11})/,
  /youtube\.com\/.*[?&]v=([\w-]{11})/,
];

function youtubeId(url) {
  for (const re of YT_PATTERNS) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "desconhecido";
  }
}

/**
 * Tenta achar uma thumbnail para o link, em ordem de prioridade:
 *   1) YouTube  -> imagem deterministica pelo ID do video
 *   2) OpenGraph (og:image / twitter:image) raspado do HTML da pagina
 *   3) null     -> o preview e exibido sem thumbnail
 */
async function deriveThumbnail(url) {
  const id = youtubeId(url);
  if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; botinsanoskol/1.0)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const html = await res.text();
    const found = matchMeta(html, "og:image") || matchMeta(html, "twitter:image");
    return found ? absolutize(found, url) : null;
  } catch {
    return null; // raspagem e best-effort; sem thumbnail nao e erro
  }
}

function matchMeta(html, prop) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

function absolutize(maybeRelative, base) {
  try {
    return new URL(maybeRelative, base).href;
  } catch {
    return maybeRelative;
  }
}

module.exports = { youtubeId, hostnameOf, deriveThumbnail };
