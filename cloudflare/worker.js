/**
 * Cloudflare Worker: Dynamic Sports BLV IPTV Playlist Generator & Web Player
 * 
 * Features:
 * - Real-time match synchronization from API for commentators (Live & Upcoming within 6 hours)
 * - Priority Sorting: Live (rank trên -> dưới) -> Non-live (rank trên -> dưới)
 * - URL Query Parameters: ?live_only=true, ?type=hls|flv, ?sort=rank|live, ?upcoming=false
 * - Built-in Modern Web Player (Hls.js & mpegts.js) supporting both HLS (.m3u8) & FLV (.flv)
 * - Interactive IPTV URL Generator directly on Web Dashboard
 * - Cloudflare Edge Caching (Zero server load, sub-millisecond responses)
 */

// Baseline 12 commentators for Gà Vàng 33 (Fixed order)
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

// Helper: Convert UTC timestamp to HH:mm in Vietnam Timezone (UTC+7)
function getVnTimeStr(timestamp) {
  if (!timestamp) return "";
  const vnOffset = 7 * 3600;
  const d = new Date((Number(timestamp) + vnOffset) * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Helper: Parse M3U text into channel objects
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

// Helper: Fetch matches from API (both Live and Upcoming within 6 hours)
async function fetchGavangMatches(apiUrl, referer) {
  const liveMap = {};
  const upcomingMap = {};
  const allMatches = [];
  const now = Math.floor(Date.now() / 1000);
  const sixHoursLater = now + 6 * 3600;

  try {
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": referer
      }
    });
    if (!res.ok) {
      console.warn(`Gavang API returned status: ${res.status}`);
      return { liveMap, upcomingMap, allMatches };
    }
    const data = await res.json();
    const matches = data.data ? Object.values(data.data) : [];

    for (const m of matches) {
      const home = (m.homeTeam?.name || "").trim();
      const away = (m.awayTeam?.name || "").trim();
      const title = (home && away) ? `${home} vs ${away}` : (m.canonicalMatchId || "Trận Đấu Trực Tiếp");
      const matchTime = Number(m.matchTime) || 0;
      const isLive = m.matchStatus === "live";
      const isUpcomingIn6h = m.matchStatus === "scheduled" && matchTime >= now && matchTime <= sixHoursLater;
      const timeStr = matchTime ? getVnTimeStr(matchTime) : "";
      const anchors = (m.anchorAppointmentVoList || []).map(a => (a.nickName || "").trim()).filter(Boolean);

      allMatches.push({
        title,
        status: m.matchStatus,
        matchTime,
        timeStr,
        anchors,
        home,
        away
      });

      if (isLive) {
        for (const nick of anchors) {
          liveMap[nick] = { title, timeStr, matchTime };
        }
      } else if (isUpcomingIn6h) {
        for (const nick of anchors) {
          // If anchor has multiple upcoming matches, pick the earlier one
          if (!upcomingMap[nick] || matchTime < upcomingMap[nick].matchTime) {
            upcomingMap[nick] = { title, timeStr, matchTime };
          }
        }
      }
    }
  } catch (err) {
    console.error("Error fetching Gavang API:", err);
  }

  return { liveMap, upcomingMap, allMatches };
}

// Helper: Build Gà Vàng channels with Live / Upcoming status
function buildGavangChannels(blvList, liveMap, upcomingMap, avatarBaseUrl) {
  const sv1 = [];
  const sv2 = [];

  for (const b of blvList) {
    const nick = b.nickName;
    const logoUrl = `${avatarBaseUrl}/${b.logo_filename}`;
    const liveInfo = liveMap[nick];
    const upcomingInfo = upcomingMap[nick];

    let displayName = `BLV ${nick}`;
    let isLive = false;
    let isUpcoming = false;
    let matchTitle = "";

    if (liveInfo) {
      isLive = true;
      matchTitle = liveInfo.title;
      displayName = `🔴 ${liveInfo.title} (${nick})`;
    } else if (upcomingInfo) {
      isUpcoming = true;
      matchTitle = upcomingInfo.title;
      displayName = `⏳ [${upcomingInfo.timeStr}] ${upcomingInfo.title} (${nick})`;
    }

    sv1.push({
      rank: b.rank,
      nickName: nick,
      displayName,
      isLive,
      isUpcoming,
      matchTitle,
      type: "hls",
      logoUrl,
      extinf: `#EXTINF:-1 group-title="🔴 ⚽ GÀ VÀNG 33" tvg-logo="${logoUrl}", ${displayName}`,
      opts: [],
      url: b.hls_url
    });

    sv2.push({
      rank: b.rank,
      nickName: nick,
      displayName,
      isLive,
      isUpcoming,
      matchTitle,
      type: "flv",
      logoUrl,
      extinf: `#EXTINF:-1 group-title="🔴 ⚽ GÀ VÀNG 33 SV2" tvg-logo="${logoUrl}", ${displayName}`,
      opts: [],
      url: b.flv_url
    });
  }

  return { sv1, sv2 };
}

// Priority Sorting: Live rank 1..12 -> Non-live rank 1..12
function sortChannels(channels, sortMode = "live") {
  if (sortMode === "rank" || sortMode === "fixed") {
    return channels;
  }
  return [...channels].sort((a, b) => {
    const aLive = a.isLive ? 1 : 0;
    const bLive = b.isLive ? 1 : 0;
    if (aLive !== bLive) {
      return bLive - aLive; // 1 before 0
    }
    return (a.rank || 999) - (b.rank || 999);
  });
}

// Filter channels by URL params: ?live_only=true, ?type=hls|flv
function filterChannels(channels, options = {}) {
  let list = channels;
  if (options.liveOnly) {
    list = list.filter(c => c.isLive);
  }
  if (options.type) {
    const targetType = options.type.toLowerCase();
    if (targetType === "hls") {
      list = list.filter(c => c.url.includes(".m3u8") || c.type === "hls");
    } else if (targetType === "flv") {
      list = list.filter(c => c.url.includes(".flv") || c.type === "flv");
    }
  }
  return list;
}

// Helper: Render modern web dashboard with built-in Web Player
function renderDashboard(host, liveMap, upcomingMap, allMatches, gvChannels, envConfig) {
  const liveCount = Object.keys(liveMap).length;
  const upcomingCount = Object.keys(upcomingMap).length;

  const endpoints = [
    { title: "⚽ Tổng Hợp BLV Tiếng Việt", name: "sport", path: "/sport.m3u", count: "137 kênh" },
    { title: "🐔 Gà Vàng 33 (Gộp SV1 + SV2)", name: "gv", path: "/gv.m3u", count: "24 kênh (HLS + FLV)" },
    { title: "🐔 Gà Vàng 33 (Server 1 HLS)", name: "gv_sv1", path: "/gv_sv1.m3u", count: "12 kênh (HLS)" },
    { title: "🐔 Gà Vàng 33 (Server 2 FLV)", name: "gv_sv2", path: "/gv_sv2.m3u", count: "12 kênh (FLV)" },
    { title: "🥤 Cola TV", name: "cola", path: "/cola.m3u", count: "79 kênh" },
    { title: "🐔 Gà Vàng 33 (Gốc)", name: "gavang33", path: "/gavang33.m3u", count: "21 kênh" },
    { title: "🐔 Gà Vàng 24H", name: "gavang24", path: "/gavang24.m3u", count: "18 kênh" },
    { title: "🏟️ Khán Đài TV", name: "khandai", path: "/khandai.m3u", count: "10 kênh" },
    { title: "🥣 Xôi Chè TV", name: "xoiche", path: "/xoiche.m3u", count: "9 kênh" }
  ];

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚽ IPTV BLV Tiếng Việt - Cloudflare Edge</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220%22><text y=%2226%22 font-size=%2226%22>⚽</text></svg>">
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mpegts.js@1.7.3/dist/mpegts.min.js"></script>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #131b2e;
      --card-hover: #1e293b;
      --accent: #38bdf8;
      --text: #f1f5f9;
      --text-dim: #94a3b8;
      --border: #1e293b;
      --green: #22c55e;
      --amber: #f59e0b;
      --red: #ef4444;
    }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; line-height: 1.5; }
    .container { max-width: 960px; margin: 0 auto; }
    header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid var(--border); }
    h1 { color: var(--accent); margin: 0 0 6px 0; font-size: 24px; font-weight: 800; }
    .meta { color: var(--text-dim); font-size: 13px; display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
    .meta code { background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #38bdf8; }

    /* Web Player Section */
    .player-wrapper { background: #000; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-bottom: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); }
    .video-container { position: relative; width: 100%; aspect-ratio: 16/9; background: #0b0f19; }
    video { width: 100%; height: 100%; display: block; }
    .player-bar { background: var(--card-bg); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); }
    .player-title { font-weight: 700; font-size: 15px; color: #fff; display: flex; align-items: center; gap: 8px; }
    .player-tag { font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 700; }
    .tag-live { background: #dc2626; color: #fff; }
    .tag-upcoming { background: #d97706; color: #fff; }
    .tag-hls { background: #0284c7; color: #fff; }
    .tag-flv { background: #7c3aed; color: #fff; }

    /* Channel Cards Grid */
    .section-title { font-size: 18px; margin: 24px 0 12px 0; color: #f8fafc; display: flex; align-items: center; justify-content: space-between; }
    .channel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .ch-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 12px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: all 0.2s; position: relative; }
    .ch-card:hover { background: var(--card-hover); border-color: var(--accent); transform: translateY(-2px); }
    .ch-card.is-live { border-left: 4px solid var(--red); background: #161e2e; }
    .ch-card.is-upcoming { border-left: 4px solid var(--amber); }
    .ch-logo { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; background: #1e293b; border: 2px solid var(--border); flex-shrink: 0; }
    .ch-info { flex: 1; min-width: 0; }
    .ch-name { font-weight: 700; font-size: 14px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ch-meta { font-size: 12px; color: var(--text-dim); display: flex; gap: 6px; align-items: center; }
    .badge-status { font-size: 10px; padding: 1px 6px; border-radius: 3px; font-weight: 700; text-transform: uppercase; }

    /* URL Generator Card */
    .generator-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 24px; }
    .generator-card h3 { margin: 0 0 12px 0; font-size: 16px; color: var(--accent); }
    .filter-options { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; }
    .filter-option { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text); background: #0f172a; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border); cursor: pointer; }
    .filter-option input { cursor: pointer; }

    /* Playlist URLs */
    .url-item { background: #0b1120; border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .url-name { font-weight: 600; font-size: 14px; min-width: 180px; }
    .url-box { flex: 1; font-family: monospace; font-size: 12px; color: #4ade80; background: #070b14; padding: 6px 10px; border-radius: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .btn-copy { background: #2563eb; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: background 0.2s; white-space: nowrap; }
    .btn-copy:hover { background: #1d4ed8; }

    .toast { position: fixed; bottom: 24px; right: 24px; background: #22c55e; color: #fff; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 13px; display: none; box-shadow: 0 4px 14px rgba(0,0,0,0.4); z-index: 99; }
    footer { text-align: center; margin-top: 30px; font-size: 12px; color: var(--text-dim); border-top: 1px solid var(--border); padding-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>⚽ IPTV THỂ THAO & BLV TIẾNG VIỆT</h1>
      <div class="meta">
        <span>⚡ Cloudflare Edge Worker</span>
        <span>🔴 Đang Live: <b>${liveCount} BLV</b></span>
        <span>⏳ Sắp Đá (6h): <b>${upcomingCount} BLV</b></span>
        <span>⏱️ Edge Cache: <b>${envConfig.CACHE_TTL}s</b></span>
      </div>
    </header>

    <!-- Web Player -->
    <div class="player-wrapper">
      <div class="video-container">
        <video id="videoPlayer" controls playsinline></video>
      </div>
      <div class="player-bar">
        <div class="player-title">
          <span id="playerBadge" class="player-tag tag-live">CHỌN KÊNH</span>
          <span id="playerTitle">Bấm vào bất kỳ kênh nào bên dưới để xem trực tiếp</span>
        </div>
        <div>
          <span id="playerType" class="player-tag tag-hls" style="display:none;">HLS</span>
        </div>
      </div>
    </div>

    <!-- Quick Play Grid (Gà Vàng 33 Servers) -->
    <div class="section-title">
      <span>📺 Kênh Gà Vàng 33 (Ưu tiên Live xếp trước)</span>
      <span style="font-size:12px; color:var(--text-dim);">Nhấn để phát ngay trên trình duyệt</span>
    </div>
    <div class="channel-grid">
      ${gvChannels.map(ch => `
        <div class="ch-card ${ch.isLive ? 'is-live' : (ch.isUpcoming ? 'is-upcoming' : '')}" onclick="playChannel('${ch.url}', '${ch.displayName.replace(/'/g, "\\'")}', '${ch.type}')">
          <img class="ch-logo" src="${ch.logoUrl}" alt="${ch.nickName}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220%22><text y=%2220%22 font-size=%2220%22>⚽</text></svg>'">
          <div class="ch-info">
            <div class="ch-name">${ch.displayName}</div>
            <div class="ch-meta">
              <span class="badge-status ${ch.isLive ? 'tag-live' : (ch.isUpcoming ? 'tag-upcoming' : 'tag-hls')}">${ch.isLive ? '🔴 LIVE' : (ch.isUpcoming ? '⏳ SẮP ĐÁ' : 'NGHỈ')}</span>
              <span>${ch.type.toUpperCase()}</span>
              <span>Rank #${ch.rank}</span>
            </div>
          </div>
        </div>
      `).join("")}
    </div>

    <!-- Interactive URL Generator -->
    <div class="generator-card">
      <h3>⚙️ Bộ Tạo Link IPTV Tùy Chỉnh (Dành cho TiviMate / OTT Navigator)</h3>
      <div class="filter-options">
        <label class="filter-option">
          <input type="checkbox" id="chkLive" onchange="updateLinks()">
          <span>🔴 Chỉ lấy kênh đang LIVE (<code>?live_only=true</code>)</span>
        </label>
        <label class="filter-option">
          <input type="checkbox" id="chkHls" onchange="updateProtocol('hls')">
          <span>⚡ Chỉ lấy luồng HLS (<code>?type=hls</code>)</span>
        </label>
        <label class="filter-option">
          <input type="checkbox" id="chkFlv" onchange="updateProtocol('flv')">
          <span>🚀 Chỉ lấy luồng FLV (<code>?type=flv</code>)</span>
        </label>
        <label class="filter-option">
          <input type="checkbox" id="chkSortRank" onchange="updateLinks()">
          <span>🔢 Giữ nguyên thứ tự rank gốc (<code>?sort=rank</code>)</span>
        </label>
      </div>

      <div id="linksContainer">
        ${endpoints.map(ep => `
          <div class="url-item">
            <div class="url-name">${ep.title}</div>
            <div class="url-box" id="url_${ep.name}">${host}${ep.path}</div>
            <button class="btn-copy" onclick="copyLink('url_${ep.name}')">Sao Chép</button>
          </div>
        `).join("")}
      </div>
    </div>

    <footer>
      Dữ liệu phát trực tiếp thu thập tự động cho mục đích học tập & giải trí cá nhân.
    </footer>
  </div>

  <div id="toast" class="toast">Đã sao chép link vào bộ nhớ tạm!</div>

  <script>
    let hlsInstance = null;
    let mpegtsInstance = null;
    const video = document.getElementById("videoPlayer");
    const pTitle = document.getElementById("playerTitle");
    const pBadge = document.getElementById("playerBadge");
    const pType = document.getElementById("playerType");

    function playChannel(url, name, type) {
      // Clean up previous instances
      if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
      if (mpegtsInstance) { mpegtsInstance.destroy(); mpegtsInstance = null; }
      video.pause();
      video.removeAttribute("src");

      pTitle.innerText = name;
      pType.style.display = "inline-block";
      pType.innerText = type.toUpperCase();
      pType.className = "player-tag " + (type === "flv" ? "tag-flv" : "tag-hls");

      if (name.includes("🔴")) {
        pBadge.className = "player-tag tag-live";
        pBadge.innerText = "TRỰC TIẾP";
      } else if (name.includes("⏳")) {
        pBadge.className = "player-tag tag-upcoming";
        pBadge.innerText = "SẮP ĐÁ";
      } else {
        pBadge.className = "player-tag tag-hls";
        pBadge.innerText = "SẴN SÀNG";
      }

      // Scroll smoothly to player
      document.querySelector(".player-wrapper").scrollIntoView({ behavior: "smooth" });

      if (type === "flv" || url.includes(".flv")) {
        if (mpegts.getFeatureList().mseLivePlayback) {
          mpegtsInstance = mpegts.createPlayer({
            type: "flv",
            isLive: true,
            url: url
          });
          mpegtsInstance.attachMediaElement(video);
          mpegtsInstance.load();
          mpegtsInstance.play().catch(e => console.warn("Autoplay blocked:", e));
        } else {
          alert("Trình duyệt không hỗ trợ phát luồng FLV trực tiếp. Hãy chọn luồng HLS!");
        }
      } else {
        // HLS
        if (Hls.isSupported()) {
          hlsInstance = new Hls({ enableWorker: true });
          hlsInstance.loadSource(url);
          hlsInstance.attachMedia(video);
          hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(e => console.warn("Autoplay blocked:", e));
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          video.play().catch(e => console.warn("Autoplay blocked:", e));
        }
      }
    }

    function updateProtocol(clicked) {
      if (clicked === "hls" && document.getElementById("chkHls").checked) {
        document.getElementById("chkFlv").checked = false;
      } else if (clicked === "flv" && document.getElementById("chkFlv").checked) {
        document.getElementById("chkHls").checked = false;
      }
      updateLinks();
    }

    function updateLinks() {
      const isLive = document.getElementById("chkLive").checked;
      const isHls = document.getElementById("chkHls").checked;
      const isFlv = document.getElementById("chkFlv").checked;
      const isRank = document.getElementById("chkSortRank").checked;

      const params = [];
      if (isLive) params.push("live_only=true");
      if (isHls) params.push("type=hls");
      if (isFlv) params.push("type=flv");
      if (isRank) params.push("sort=rank");

      const query = params.length > 0 ? "?" + params.join("&") : "";
      const baseEndpoints = ${JSON.stringify(endpoints)};
      
      baseEndpoints.forEach(ep => {
        const el = document.getElementById("url_" + ep.name);
        if (el) {
          el.innerText = "${host}" + ep.path + query;
        }
      });
    }

    function copyLink(id) {
      const el = document.getElementById(id);
      navigator.clipboard.writeText(el.innerText).then(() => {
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

    // 2. Parse Query Parameters
    const searchParams = url.searchParams;
    const isLiveOnly = searchParams.get("live_only") === "true" || searchParams.get("live") === "1";
    const streamType = searchParams.get("type") || searchParams.get("format") || null; // 'hls' or 'flv'
    const sortMode = searchParams.get("sort") || "live"; // 'live' (default) or 'rank'
    const filterOptions = { liveOnly: isLiveOnly, type: streamType };

    // 3. Cloudflare Edge Cache Check (Unique per URL including query parameters)
    const cache = typeof caches !== "undefined" ? caches.default : null;
    const cacheKey = new Request(request.url, request);
    let cachedResponse = cache ? await cache.match(cacheKey) : null;
    if (cachedResponse) {
      return cachedResponse;
    }

    // 4. Fetch Gà Vàng API (Both Live and Upcoming in 6 hours)
    const { liveMap, upcomingMap, allMatches } = await fetchGavangMatches(GAVANG_API_URL, GAVANG_REFERER);

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

    const { sv1, sv2 } = buildGavangChannels(blvList, liveMap, upcomingMap, AVATAR_BASE);

    // 5. Handle Web Dashboard
    if (path === "/" || path === "/index.html") {
      // Sort SV1 with priority Live -> Non-live for dashboard preview
      const previewChannels = sortChannels(sv1, "live");
      const html = renderDashboard(host, liveMap, upcomingMap, allMatches, previewChannels, envConfig);
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

    // 6. Handle Gà Vàng 33 Dedicated Servers (gv, gv_sv1, gv_sv2)
    if (["/gv", "/gv.m3u", "/gv_sv1", "/gv_sv1.m3u", "/gv_sv2", "/gv_sv2.m3u"].includes(path)) {
      let finalChannels = [];
      let playlistTitle = "";

      if (path === "/gv_sv1" || path === "/gv_sv1.m3u") {
        playlistTitle = "⚽ GÀ VÀNG 33 - SERVER 1 HLS";
        finalChannels = filterChannels(sortChannels(sv1, sortMode), filterOptions);
      } else if (path === "/gv_sv2" || path === "/gv_sv2.m3u") {
        playlistTitle = "⚽ GÀ VÀNG 33 - SERVER 2 FLV";
        finalChannels = filterChannels(sortChannels(sv2, sortMode), filterOptions);
      } else {
        playlistTitle = "⚽ GÀ VÀNG 33 (SV1 & SV2)";
        const sortedSv1 = filterChannels(sortChannels(sv1, sortMode), filterOptions);
        const sortedSv2 = filterChannels(sortChannels(sv2, sortMode), filterOptions);
        finalChannels = [...sortedSv1, ...sortedSv2];
      }

      const content = formatPlaylist(playlistTitle, finalChannels, DEFAULT_EPG, DEFAULT_UA);
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

    // 7. Handle Master Sport & Categorized Playlists (cola, gavang33, gavang24, khandai, xoiche)
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

      // Realtime injection: Replace commentator name with Live or Upcoming (6h) match title
      selectedChannels = selectedChannels.map((c, idx) => {
        let updatedExtinf = c.extinf;
        let isLive = false;
        let isUpcoming = false;

        // Check live first
        for (const [nick, info] of Object.entries(liveMap)) {
          if (updatedExtinf.includes(nick)) {
            const regex = new RegExp(`,\\s*(BLV\\s+)?${nick}\\b`, "g");
            updatedExtinf = updatedExtinf.replace(regex, `, 🔴 ${info.title} (${nick})`);
            isLive = true;
            break;
          }
        }

        // Check upcoming in 6h if not live
        if (!isLive) {
          for (const [nick, info] of Object.entries(upcomingMap)) {
            if (updatedExtinf.includes(nick)) {
              const regex = new RegExp(`,\\s*(BLV\\s+)?${nick}\\b`, "g");
              updatedExtinf = updatedExtinf.replace(regex, `, ⏳ [${info.timeStr}] ${info.title} (${nick})`);
              isUpcoming = true;
              break;
            }
          }
        }

        return { ...c, extinf: updatedExtinf, isLive, isUpcoming, rank: idx + 1 };
      });

      // Apply priority sorting (Live first) and query parameter filters
      selectedChannels = filterChannels(sortChannels(selectedChannels, sortMode), filterOptions);

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
