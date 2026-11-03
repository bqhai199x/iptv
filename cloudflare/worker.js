/**
 * Cloudflare Worker: Dynamic Sports BLV IPTV Playlist Generator
 * 
 * Features:
 * - Real-time match name synchronization for BLV commentators (Gà Vàng 33, etc.)
 * - Dynamic environment variables (GAVANG_REFERER, GAVANG_API_URL, GITHUB_RAW_BASE, CACHE_TTL, etc.)
 * - Edge Caching via Cloudflare Cache API (Zero server load, sub-millisecond responses)
 * - Built-in Web Dashboard for easy 1-click URL copying
 * - Supports both standard M3U (.m3u) and Direct File (no extension) endpoints
 */

// Fixed fallback commentators baseline for Gà Vàng 33
const DEFAULT_GAVANG_FIXED = [
  { rank: 1, nickName: "Gà Siêu Quỷ", logo_filename: "ga_sieu_quy.png", hls_url: "https://live2.zktsva.app/live/304565.m3u8", flv_url: "https://live2.zktsva.app/live/304565.flv" },
  { rank: 2, nickName: "Gà Siêu Gáy", logo_filename: "ga_sieu_gay.jpg", hls_url: "https://live2.zktsva.app/live/294335.m3u8", flv_url: "https://live2.zktsva.app/live/294335.flv" },
  { rank: 3, nickName: "Gà Siêu Péo", logo_filename: "ga_sieu_peo.png", hls_url: "https://live2.zktsva.app/live/303098.m3u8", flv_url: "https://live2.zktsva.app/live/303098.flv" },
  { rank: 4, nickName: "Gà Siêu Kiêu", logo_filename: "ga_sieu_kieu.png", hls_url: "https://live2.zktsva.app/live/741294.m3u8", flv_url: "https://live2.zktsva.app/live/741294.flv" },
  { rank: 5, nickName: "Gà Siêu Tồ", logo_filename: "ga_sieu_to.jpg", hls_url: "https://live2.zktsva.app/live/796315.m3u8", flv_url: "https://live2.zktsva.app/live/796315.flv" },
  { rank: 6, nickName: "Gà Siêu Nhí", logo_filename: "ga_sieu_nhi.jpg", hls_url: "https://live2.zktsva.app/live/301263.m3u8", flv_url: "https://live2.zktsva.app/live/301263.flv" },
  { rank: 7, nickName: "Gà Siêu Mõm", logo_filename: "ga_sieu_mom.png", hls_url: "https://live2.zktsva.app/live/300523.m3u8", flv_url: "https://live2.zktsva.app/live/300523.flv" },
  { rank: 8, nickName: "Gà Siêu Bệu", logo_filename: "ga_sieu_beu.jpg", hls_url: "https://live2.zktsva.app/live/289650.m3u8", flv_url: "https://live2.zktsva.app/live/289650.flv" },
  { rank: 9, nickName: "Gà Ô Long", logo_filename: "ga_o_long.png", hls_url: "https://live2.zktsva.app/live/432017.m3u8", flv_url: "https://live2.zktsva.app/live/432017.flv" },
  { rank: 10, nickName: "Gà Siêu Tốc", logo_filename: "ga_sieu_toc.jpg", hls_url: "https://live2.zktsva.app/live/307240.m3u8", flv_url: "https://live2.zktsva.app/live/307240.flv" },
  { rank: 11, nickName: "Gà Siêu Ngố", logo_filename: "ga_sieu_ngo.jpg", hls_url: "https://live2.zktsva.app/live/301238.m3u8", flv_url: "https://live2.zktsva.app/live/301238.flv" },
  { rank: 12, nickName: "Gà Siêu Son", logo_filename: "ga_sieu_son.png", hls_url: "https://live2.zktsva.app/live/306290.m3u8", flv_url: "https://live2.zktsva.app/live/306290.flv" }
];

const BLV_GROUPS = [
  "🔴 ⚽ COLA TV",
  "🔴 ⚽ 🏀 COLA TV SV2",
  "🔴 ⚽ 🏀 COLA TV SV3",
  "🔴 ⚽ GÀ VÀNG 33",
  "🔴 ⚽ GÀ VÀNG 33 SV2",
  "🔴 ⚽ 🏐 KHÁN ĐÀI TV",
  "🔴 ⚽ 🏐 GÀ VÀNG 24h",
  "🔴 ⚽ 🏐 XÔI CHÈ TV"
];

// Helper: Parse M3U content into structured channels
function parseM3U(rawText) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const channels = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("#EXTINF")) {
      const extinf = line;
      const opts = [];
      let url = null;
      i++;
      while (i < lines.length && !lines[i].startsWith("#EXTINF")) {
        const sub = lines[i];
        if (sub.startsWith("#")) {
          opts.push(sub);
        } else {
          url = sub;
        }
        i++;
      }
      if (url) {
        channels.push({ extinf, opts, url });
      }
    } else {
      i++;
    }
  }
  return channels;
}

// Helper: Format channel list into M3U string
function formatPlaylist(title, channels, defaultEpg, defaultUa) {
  const lines = [`#EXTM3U name="${title}" url-tvg="${defaultEpg}"`];
  for (const ch of channels) {
    lines.push(ch.extinf);
    lines.push(`#EXTVLCOPT:http-user-agent=${defaultUa}`);
    if (ch.opts) {
      for (const opt of ch.opts) {
        if (!opt.toLowerCase().includes("http-user-agent")) {
          lines.push(opt);
        }
      }
    }
    lines.push(ch.url);
  }
  return lines.join("\n") + "\n";
}

// Helper: Fetch live match title mapping for Gà Vàng commentators
async function fetchGavangLiveMatches(apiUrl, referer) {
  const liveMap = {};
  const allMatches = [];
  try {
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": referer
      }
    });
    if (!res.ok) {
      console.warn(`Gavang API returned status: ${res.status}`);
      return { liveMap, allMatches };
    }
    const data = await res.json();
    const matches = data.data ? Object.values(data.data) : [];
    for (const m of matches) {
      const home = (m.homeTeam?.name || "").trim();
      const away = (m.awayTeam?.name || "").trim();
      const title = (home && away) ? `${home} vs ${away}` : (m.canonicalMatchId || "Trận Đấu Trực Tiếp");
      const isLive = m.matchStatus === "live";
      
      allMatches.push({
        title,
        status: m.matchStatus,
        matchTime: m.matchTime,
        anchors: (m.anchorAppointmentVoList || []).map(a => (a.nickName || "").trim()).filter(Boolean)
      });

      if (isLive) {
        for (const a of (m.anchorAppointmentVoList || [])) {
          const nick = (a.nickName || "").trim();
          if (nick) {
            liveMap[nick] = title;
          }
        }
      }
    }
  } catch (err) {
    console.error("Error fetching Gavang API:", err);
  }
  return { liveMap, allMatches };
}

// Helper: Generate Gà Vàng dedicated servers (SV1 HLS & SV2 FLV)
function buildGavangChannels(blvList, liveMap, avatarBaseUrl) {
  const sv1 = [];
  const sv2 = [];
  for (const b of blvList) {
    const nick = b.nickName;
    const logoUrl = `${avatarBaseUrl}/${b.logo_filename}`;
    const liveTitle = liveMap[nick];
    const displayName = liveTitle ? liveTitle : `BLV ${nick}`;

    sv1.push({
      extinf: `#EXTINF:-1 group-title="🔴 ⚽ GÀ VÀNG 33" tvg-logo="${logoUrl}", ${displayName}`,
      opts: [],
      url: b.hls_url
    });
    sv2.push({
      extinf: `#EXTINF:-1 group-title="🔴 ⚽ GÀ VÀNG 33 SV2" tvg-logo="${logoUrl}", ${displayName}`,
      opts: [],
      url: b.flv_url
    });
  }
  return { sv1, sv2 };
}

// Helper: Render modern web dashboard
function renderDashboard(host, liveMap, allMatches, envConfig) {
  const liveCount = Object.keys(liveMap).length;
  const scheduledCount = allMatches.filter(m => m.status === "scheduled").length;

  const endpoints = [
    { title: "⚽ Tổng Hợp BLV Tiếng Việt (137 Kênh)", name: "sport", m3u: "/sport.m3u", direct: "/sport", count: "137 kênh" },
    { title: "🐔 Gà Vàng 33 (Gộp SV1 + SV2)", name: "gv", m3u: "/gv.m3u", direct: "/gv", count: "24 kênh (HLS + FLV)" },
    { title: "🐔 Gà Vàng 33 (Server 1 HLS)", name: "gv_sv1", m3u: "/gv_sv1.m3u", direct: "/gv_sv1", count: "12 kênh (HLS)" },
    { title: "🐔 Gà Vàng 33 (Server 2 FLV)", name: "gv_sv2", m3u: "/gv_sv2.m3u", direct: "/gv_sv2", count: "12 kênh (FLV)" },
    { title: "🥤 Cola TV", name: "cola", m3u: "/cola.m3u", direct: "/cola", count: "79 kênh" },
    { title: "🐔 Gà Vàng 33 (Gốc)", name: "gavang33", m3u: "/gavang33.m3u", direct: "/gavang33", count: "21 kênh" },
    { title: "🐔 Gà Vàng 24H", name: "gavang24", m3u: "/gavang24.m3u", direct: "/gavang24", count: "18 kênh" },
    { title: "🏟️ Khán Đài TV", name: "khandai", m3u: "/khandai.m3u", direct: "/khandai", count: "10 kênh" },
    { title: "🥣 Xôi Chè TV", name: "xoiche", m3u: "/xoiche.m3u", direct: "/xoiche", count: "9 kênh" }
  ];

  let liveMatchesHtml = "";
  if (liveCount > 0) {
    liveMatchesHtml = `
      <div class="card live-card">
        <h3>🔴 Đang Trực Tiếp (${liveCount} BLV lên sóng):</h3>
        <ul>
          ${Object.entries(liveMap).map(([nick, match]) => `<li><b>BLV ${nick}</b>: <span class="highlight">${match}</span></li>`).join("")}
        </ul>
      </div>
    `;
  } else {
    liveMatchesHtml = `
      <div class="card status-card">
        <span>💤 Hiện tại chưa có trận đấu nào đang live (Đã tìm thấy ${scheduledCount} trận sắp đá). Các kênh hiển thị tên BLV mặc định.</span>
      </div>
    `;
  }

  const cardsHtml = endpoints.map(ep => `
    <div class="card">
      <div class="card-header">
        <h4>${ep.title}</h4>
        <span class="badge">${ep.count}</span>
      </div>
      <div class="url-group">
        <label>Link M3U (.m3u):</label>
        <div class="input-copy">
          <input type="text" readonly value="${host}${ep.m3u}" id="url_${ep.name}_m3u">
          <button onclick="copyText('url_${ep.name}_m3u')">Copy</button>
        </div>
      </div>
      <div class="url-group">
        <label>Link Direct (Không đuôi - TiviMate/OTT):</label>
        <div class="input-copy">
          <input type="text" readonly value="${host}${ep.direct}" id="url_${ep.name}_direct">
          <button onclick="copyText('url_${ep.name}_direct')">Copy</button>
        </div>
      </div>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚽ Thể Thao BLV Tiếng Việt - Cloudflare Edge</title>
  <style>
    :root { --bg: #090d16; --card-bg: #131b2e; --accent: #38bdf8; --text: #f1f5f9; --text-dim: #94a3b8; --border: #1e293b; --green: #22c55e; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; line-height: 1.5; }
    .container { max-width: 900px; margin: 0 auto; }
    header { text-align: center; margin-bottom: 25px; border-bottom: 1px solid var(--border); padding-bottom: 20px; }
    h1 { color: var(--accent); margin: 0 0 8px 0; font-size: 24px; }
    .meta { color: var(--text-dim); font-size: 13px; }
    .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .card-header h4 { margin: 0; font-size: 16px; color: #fff; }
    .badge { background: #1e293b; color: var(--accent); font-size: 12px; padding: 4px 10px; border-radius: 20px; font-weight: 600; }
    .url-group { margin-top: 8px; }
    .url-group label { display: block; font-size: 12px; color: var(--text-dim); margin-bottom: 4px; }
    .input-copy { display: flex; gap: 8px; }
    input[type="text"] { flex: 1; background: #0b1120; border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; color: #4ade80; font-family: monospace; font-size: 13px; outline: none; }
    button { background: #2563eb; color: #fff; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-weight: 600; font-size: 13px; transition: background 0.2s; }
    button:hover { background: #1d4ed8; }
    .live-card { border-left: 4px solid var(--green); background: #0e2a22; }
    .live-card h3 { margin-top: 0; color: #4ade80; font-size: 15px; }
    .live-card ul { margin: 6px 0 0 18px; padding: 0; }
    .live-card li { margin-bottom: 4px; font-size: 14px; }
    .status-card { color: var(--text-dim); font-size: 13px; background: #0f172a; text-align: center; }
    .highlight { color: #facc15; font-weight: 600; }
    footer { text-align: center; margin-top: 30px; font-size: 12px; color: var(--text-dim); border-top: 1px solid var(--border); padding-top: 15px; }
    .toast { position: fixed; bottom: 20px; right: 20px; background: #22c55e; color: #fff; padding: 10px 18px; border-radius: 6px; font-weight: 600; display: none; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>⚽ IPTV THỂ THAO & BLV TIẾNG VIỆT</h1>
      <div class="meta">
        ⚡ Cloudflare Edge Worker | 🌐 Referer: <code>${envConfig.GAVANG_REFERER}</code> | ⏱️ Cache TTL: ${envConfig.CACHE_TTL}s
      </div>
    </header>

    ${liveMatchesHtml}
    ${cardsHtml}

    <footer>
      Dữ liệu phát trực tiếp thu thập tự động cho mục đích học tập & giải trí cá nhân.
    </footer>
  </div>

  <div id="toast" class="toast">Đã sao chép vào bộ nhớ tạm!</div>
  <script>
    function copyText(id) {
      const el = document.getElementById(id);
      navigator.clipboard.writeText(el.value).then(() => {
        const toast = document.getElementById("toast");
        toast.style.display = "block";
        setTimeout(() => toast.style.display = "none", 2000);
      });
    }
  </script>
</body>
</html>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = `${url.protocol}//${url.host}`;
    let path = url.pathname.toLowerCase().replace(/\/+$/, "") || "/";

    // Allow GET / HEAD only
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // 1. Resolve Dynamic Environment Variables with safe fallbacks
    const GAVANG_REFERER = env.GAVANG_REFERER || "https://gavang33.ac";
    const GAVANG_API_URL = env.GAVANG_API_URL || "https://gavangtv-api.adviceme.io/api/v1/matches?webType=gavang";
    const GITHUB_RAW_BASE = env.GITHUB_RAW_BASE || "https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main";
    const CACHE_TTL = parseInt(env.CACHE_TTL || "180", 10);
    const DEFAULT_EPG = env.DEFAULT_EPG || "https://lichphatsong.io.vn/epg.xml";
    const DEFAULT_UA = env.DEFAULT_UA || "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    const AVATAR_BASE = `${GITHUB_RAW_BASE}/assets/blv`;

    const envConfig = { GAVANG_REFERER, GAVANG_API_URL, GITHUB_RAW_BASE, CACHE_TTL };

    // 2. Cloudflare Edge Cache Check
    const cache = typeof caches !== "undefined" ? caches.default : null;
    const cacheKey = new Request(request.url, request);
    let cachedResponse = cache ? await cache.match(cacheKey) : null;
    if (cachedResponse) {
      return cachedResponse;
    }

    // 3. Fetch Gà Vàng API for dynamic live matches
    const { liveMap, allMatches } = await fetchGavangLiveMatches(GAVANG_API_URL, GAVANG_REFERER);

    // 4. Handle Web Dashboard
    if (path === "/" || path === "/index.html") {
      const html = renderDashboard(host, liveMap, allMatches, envConfig);
      const res = new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": `public, max-age=60`,
          "Access-Control-Allow-Origin": "*"
        }
      });
      if (cache) ctx.waitUntil(cache.put(cacheKey, res.clone()));
      return res;
    }

    // 5. Handle Gà Vàng 33 Dedicated Servers (gv, gv_sv1, gv_sv2)
    // Support both .m3u and direct extensionless routes
    if (["/gv", "/gv.m3u", "/gv_sv1", "/gv_sv1.m3u", "/gv_sv2", "/gv_sv2.m3u"].includes(path)) {
      // Load fixed BLVs (Try GitHub first, fallback to DEFAULT_GAVANG_FIXED)
      let blvList = DEFAULT_GAVANG_FIXED;
      try {
        const fixedRes = await fetch(`${GITHUB_RAW_BASE}/sources/gavang33_fixed.json`);
        if (fixedRes.ok) {
          blvList = await fixedRes.json();
        }
      } catch (e) {
        blvList = DEFAULT_GAVANG_FIXED;
      }

      const { sv1, sv2 } = buildGavangChannels(blvList, liveMap, AVATAR_BASE);
      let content = "";

      if (path === "/gv_sv1" || path === "/gv_sv1.m3u") {
        content = formatPlaylist("⚽ GÀ VÀNG 33 - SERVER 1 HLS", sv1, DEFAULT_EPG, DEFAULT_UA);
      } else if (path === "/gv_sv2" || path === "/gv_sv2.m3u") {
        content = formatPlaylist("⚽ GÀ VÀNG 33 - SERVER 2 FLV", sv2, DEFAULT_EPG, DEFAULT_UA);
      } else {
        content = formatPlaylist("⚽ GÀ VÀNG 33 (SV1 & SV2)", [...sv1, ...sv2], DEFAULT_EPG, DEFAULT_UA);
      }

      const res = new Response(content, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
          "Cache-Control": `public, max-age=${CACHE_TTL}`,
          "Access-Control-Allow-Origin": "*"
        }
      });
      if (cache) ctx.waitUntil(cache.put(cacheKey, res.clone()));
      return res;
    }

    // 6. Handle Master Sport & Categorized Playlists (cola, gavang33, gavang24, khandai, xoiche)
    const categoryRoutes = {
      "/sport": { title: "⚽ THỂ THAO & BLV TIẾNG VIỆT", filter: null },
      "/sport.m3u": { title: "⚽ THỂ THAO & BLV TIẾNG VIỆT", filter: null },
      "/cola": { title: "⚽ COLA TV (BLV Tiếng Việt)", filter: "COLA TV" },
      "/cola.m3u": { title: "⚽ COLA TV (BLV Tiếng Việt)", filter: "COLA TV" },
      "/gavang33": { title: "⚽ GÀ VÀNG 33 (BLV Tiếng Việt)", filter: "GÀ VÀNG 33" },
      "/gavang33.m3u": { title: "⚽ GÀ VÀNG 33 (BLV Tiếng Việt)", filter: "GÀ VÀNG 33" },
      "/gavang24": { title: "⚽ GÀ VÀNG 24H (BLV Tiếng Việt)", filter: "GÀ VÀNG 24h" },
      "/gavang24.m3u": { title: "⚽ GÀ VÀNG 24H (BLV Tiếng Việt)", filter: "GÀ VÀNG 24h" },
      "/khandai": { title: "⚽ KHÁN ĐÀI TV (BLV Tiếng Việt)", filter: "KHÁN ĐÀI TV" },
      "/khandai.m3u": { title: "⚽ KHÁN ĐÀI TV (BLV Tiếng Việt)", filter: "KHÁN ĐÀI TV" },
      "/xoiche": { title: "⚽ XÔI CHÈ TV (BLV Tiếng Việt)", filter: "XÔI CHÈ TV" },
      "/xoiche.m3u": { title: "⚽ XÔI CHÈ TV (BLV Tiếng Việt)", filter: "XÔI CHÈ TV" }
    };

    const targetRoute = categoryRoutes[path];
    if (targetRoute) {
      let rawBaseText = "";
      try {
        const rawRes = await fetch(`${GITHUB_RAW_BASE}/sources/base_channels.m3u`);
        if (rawRes.ok) {
          rawBaseText = await rawRes.text();
        }
      } catch (e) {
        console.error("Error fetching base_channels.m3u:", e);
      }

      if (!rawBaseText) {
        return new Response("Error: Unable to load base channels.", { status: 502 });
      }

      const allBaseChannels = parseM3U(rawBaseText).filter(c => 
        BLV_GROUPS.some(grp => c.extinf.includes(grp))
      );

      let selectedChannels = targetRoute.filter
        ? allBaseChannels.filter(c => c.extinf.includes(targetRoute.filter))
        : allBaseChannels;

      // Realtime injection: Replace commentator name with live match title in extinf
      if (Object.keys(liveMap).length > 0) {
        selectedChannels = selectedChannels.map(c => {
          let updatedExtinf = c.extinf;
          for (const [nick, title] of Object.entries(liveMap)) {
            if (updatedExtinf.includes(nick)) {
              // Replace e.g. ", BLV Gà Siêu Quỷ" or ", Gà Siêu Quỷ" with ", Man Utd vs Chelsea (Gà Siêu Quỷ)"
              const regex = new RegExp(`,\\s*(BLV\\s+)?${nick}\\b`, "g");
              updatedExtinf = updatedExtinf.replace(regex, `, ${title} (${nick})`);
            }
          }
          return { ...c, extinf: updatedExtinf };
        });
      }

      const content = formatPlaylist(targetRoute.title, selectedChannels, DEFAULT_EPG, DEFAULT_UA);
      const res = new Response(content, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
          "Cache-Control": `public, max-age=${CACHE_TTL}`,
          "Access-Control-Allow-Origin": "*"
        }
      });
      if (cache) ctx.waitUntil(cache.put(cacheKey, res.clone()));
      return res;
    }

    return new Response("Not Found", { status: 404 });
  }
};
