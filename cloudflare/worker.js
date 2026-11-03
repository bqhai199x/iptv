/**
 * Cloudflare Worker: Dynamic Sports BLV IPTV Playlist Generator & Web Player
 * 
 * Features:
 * - Real-time match synchronization from API for commentators (Live & Upcoming within 6 hours)
 * - Pure internal Priority Sorting: Live first (rank trên -> dưới), then Non-live (rank trên -> dưới)
 * - Web Player with Live Source Switcher: Server 1 (HLS .m3u8) & Server 2 (FLV .flv via mpegts.js)
 * - Ultra-wide 2K screen responsive UI (max-width up to 2300px)
 * - Floating rich tooltips on match label hover showing complete un-truncated match info
 * - URL Query Parameters: ?live_only=true, ?type=hls|flv
 * - Cloudflare Edge Caching (Zero server load, sub-millisecond responses)
 */

// Baseline 12 commentators for Gà Vàng 33 (Fixed internal rank)
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

// Helper: Fetch matches from API (Live & Upcoming within 6 hours)
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
      console.warn(`Gavang API status: ${res.status}`);
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

// Build Gà Vàng commentators (with internal rank, live & upcoming mapping)
function buildGavangChannels(blvList, liveMap, upcomingMap, avatarBaseUrl) {
  const sv1 = [];
  const sv2 = [];
  const combined = [];

  for (const b of blvList) {
    const nick = b.nickName;
    const logoUrl = `${avatarBaseUrl}/${b.logo_filename}`;
    const liveInfo = liveMap[nick];
    const upcomingInfo = upcomingMap[nick];

    let displayName = `BLV ${nick}`;
    let isLive = false;
    let isUpcoming = false;
    let matchTitle = "";
    let timeStr = "";

    if (liveInfo) {
      isLive = true;
      matchTitle = liveInfo.title;
      timeStr = liveInfo.timeStr;
      displayName = liveInfo.title;
    } else if (upcomingInfo) {
      isUpcoming = true;
      matchTitle = upcomingInfo.title;
      timeStr = upcomingInfo.timeStr;
      displayName = `[${upcomingInfo.timeStr}] ${upcomingInfo.title}`;
    }

    sv1.push({
      rank: b.rank,
      nickName: nick,
      displayName,
      isLive,
      isUpcoming,
      matchTitle,
      timeStr,
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
      timeStr,
      type: "flv",
      logoUrl,
      extinf: `#EXTINF:-1 group-title="🔴 ⚽ GÀ VÀNG 33 SV2" tvg-logo="${logoUrl}", ${displayName}`,
      opts: [],
      url: b.flv_url
    });

    combined.push({
      rank: b.rank,
      nickName: nick,
      displayName,
      isLive,
      isUpcoming,
      matchTitle,
      timeStr,
      logoUrl,
      hls_url: b.hls_url,
      flv_url: b.flv_url
    });
  }

  return { sv1, sv2, combined };
}

// Internal Priority Sorting: Live rank trên -> dưới, then Non-live rank trên -> dưới
function sortChannels(channels) {
  return [...channels].sort((a, b) => {
    const aLive = a.isLive ? 1 : 0;
    const bLive = b.isLive ? 1 : 0;
    if (aLive !== bLive) {
      return bLive - aLive;
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

// Helper: Render modern web dashboard with Web Player, Source Switcher & 2K Layout
function renderDashboard(host, liveMap, upcomingMap, blvList, envConfig) {
  const liveCount = Object.keys(liveMap).length;
  const upcomingCount = Object.keys(upcomingMap).length;

  const endpoints = [
    { title: "⚽ Tổng Hợp BLV Tiếng Việt", name: "sport", path: "/sport.m3u", count: "137 kênh" },
    { title: "🐔 Gà Vàng 33 (SV1 + SV2)", name: "gv", path: "/gv.m3u", count: "24 kênh" },
    { title: "🐔 Gà Vàng 33 (Server 1 HLS)", name: "gv_sv1", path: "/gv_sv1.m3u", count: "12 kênh" },
    { title: "🐔 Gà Vàng 33 (Server 2 FLV)", name: "gv_sv2", path: "/gv_sv2.m3u", count: "12 kênh" },
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>⚽ IPTV BLV Tiếng Việt - Cloudflare Edge</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚽</text></svg>">
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
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html {
      min-height: 100%;
      -webkit-text-size-adjust: 100%;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 16px 20px;
      line-height: 1.5;
      overflow-x: hidden;
      min-height: 100vh;
      -webkit-tap-highlight-color: transparent;
    }
    
    /* 2K Screen Max-width layout */
    .container {
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
    }
    @media (min-width: 2000px) {
      .container { max-width: 1680px; padding: 24px 30px; }
      body { padding: 24px 30px; }
    }

    header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border);
      width: 100%;
      max-width: 100%;
      overflow: hidden;
    }
    h1 {
      color: var(--accent);
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      word-break: break-word;
    }

    /* Web Player Section - Chuẩn 16:9 */
    .player-wrapper {
      background: #000;
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      margin-bottom: 24px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.7);
      width: 100%;
      max-width: 100%;
    }
    .video-container {
      position: relative;
      width: 100%;
      max-width: 100%;
      aspect-ratio: 16 / 9;
      background: #070b12;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
      -webkit-user-select: none;
      overflow: hidden;
      cursor: pointer;
    }
    video { width: 100%; height: 100%; max-width: 100%; display: block; object-fit: contain; }

    .player-bar {
      background: var(--card-bg);
      padding: 12px 16px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      border-top: 1px solid var(--border);
      width: 100%;
      max-width: 100%;
      overflow: hidden;
    }
    .player-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      max-width: 100%;
      flex: 1 1 240px;
      overflow: hidden;
    }
    .player-title {
      font-weight: 700;
      font-size: 15px;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
      flex: 1;
    }
    
    .player-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      max-width: 100%;
    }

    /* Source Switcher in Player Bar */
    .source-switcher { display: flex; align-items: center; gap: 6px; background: #0b1120; padding: 3px 6px; border-radius: 8px; border: 1px solid var(--border); }
    .source-label { font-size: 11px; color: var(--text-dim); font-weight: 600; padding: 0 4px; }
    .btn-source { background: #1e293b; color: var(--text-dim); border: 1px solid var(--border); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 700; transition: all 0.2s; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; }
    .btn-source:hover { background: #334155; color: #fff; }
    .btn-source.active { background: #2563eb; color: #fff; border-color: #38bdf8; box-shadow: 0 0 10px rgba(37,99,235,0.5); }

    .player-tag { font-size: 11px; padding: 3px 10px; border-radius: 4px; font-weight: 800; letter-spacing: 0.5px; flex-shrink: 0; }
    .tag-live { background: #dc2626; color: #fff; }
    .tag-upcoming { background: #d97706; color: #fff; }
    .tag-ready { background: #0284c7; color: #fff; }

    /* Channel Cards Grid */
    .section-title { font-size: 18px; font-weight: 700; margin: 24px 0 12px 0; color: #f8fafc; display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 100%; overflow: hidden; }
    .channel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 14px; margin-bottom: 24px; width: 100%; max-width: 100%; }
    @media (min-width: 2000px) {
      .channel-grid { grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 18px; }
    }

    .ch-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; transition: all 0.2s ease; position: relative; cursor: pointer; width: 100%; max-width: 100%; min-width: 0; }
    .ch-card:hover { background: var(--card-hover); border-color: var(--accent); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.4); z-index: 50; }
    .ch-card.is-live { border-left: 4px solid var(--red); background: #161e2e; }
    .ch-card.is-upcoming { border-left: 4px solid var(--amber); }
    .ch-card.is-playing { border-color: var(--accent); box-shadow: 0 0 16px rgba(56, 189, 248, 0.4); }
    .ch-logo { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; background: #1e293b; border: 2px solid var(--border); flex-shrink: 0; }
    
    .ch-info { flex: 1; min-width: 0; }

    /* Match Label with Full Tooltip */
    .tooltip-wrapper { position: relative; display: block; width: 100%; min-width: 0; }
    .ch-name { font-weight: 700; font-size: 14px; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; color: #fff; min-width: 0; }
    
    .custom-tooltip {
      visibility: hidden; opacity: 0; position: absolute; bottom: calc(100% + 10px); left: 0;
      transform: translateY(6px); background: #070b14; color: #f8fafc; border: 1px solid var(--accent);
      padding: 10px 14px; border-radius: 8px; font-size: 13px; line-height: 1.4;
      width: max-content; max-width: 340px; box-shadow: 0 10px 30px rgba(0,0,0,0.85);
      z-index: 999; pointer-events: none; transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .custom-tooltip::after {
      content: ""; position: absolute; top: 100%; left: 24px; border-width: 6px; border-style: solid;
      border-color: var(--accent) transparent transparent transparent;
    }
    .tooltip-wrapper:hover .custom-tooltip,
    .ch-info:hover .custom-tooltip { visibility: visible; opacity: 1; transform: translateY(0); }
    .tooltip-header { font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
    .tooltip-match { font-size: 14px; font-weight: 700; color: #38bdf8; margin-bottom: 4px; }
    .tooltip-extra { font-size: 12px; color: var(--text-dim); }

    .ch-meta { font-size: 12px; color: var(--text-dim); display: flex; gap: 8px; align-items: center; }
    .badge-status { font-size: 10px; padding: 2px 7px; border-radius: 4px; font-weight: 800; letter-spacing: 0.5px; }

    /* Action Buttons on Card */
    .ch-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
    .btn-ch-play { background: #1e293b; color: #fff; border: 1px solid var(--border); padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
    .btn-ch-play:hover { background: #2563eb; border-color: #38bdf8; }
    .btn-ch-hls { color: #38bdf8; }
    .btn-ch-flv { color: #c084fc; }

    /* URL Generator Card */
    .generator-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 28px; }
    .generator-card h3 { margin: 0 0 14px 0; font-size: 17px; color: var(--accent); line-height: 1.4; }
    .filter-options { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
    .filter-option { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text); background: #0f172a; padding: 8px 14px; border-radius: 6px; border: 1px solid var(--border); cursor: pointer; user-select: none; }
    .filter-option input { cursor: pointer; accent-color: #38bdf8; }

    /* Playlist URLs */
    .url-item { background: #0b1120; border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; display: flex; align-items: center; gap: 14px; }
    .url-info { width: 340px; flex: 0 0 340px; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-shrink: 0; }
    .url-name { font-weight: 600; font-size: 14px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .url-badge { font-size: 11px; color: var(--text-dim); background: #1e293b; padding: 2px 7px; border-radius: 4px; white-space: nowrap; flex-shrink: 0; }
    .url-actions { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
    .url-box { flex: 1; min-width: 0; font-family: monospace; font-size: 12px; color: #4ade80; background: #070b14; padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; user-select: all; -webkit-user-select: all; }
    .btn-copy { background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 700; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; }
    .btn-copy:hover { background: #1d4ed8; }
    .btn-copy:active { transform: scale(0.96); }
    .btn-copy.copied { background: #16a34a !important; color: #fff !important; }

    /* Mobile Responsive Optimizations */
    @media (max-width: 768px) {
      body {
        padding: 10px 8px;
      }
      header { margin-bottom: 14px; padding-bottom: 10px; width: 100%; overflow: hidden; }
      h1 { font-size: 18px !important; }

      .player-wrapper { border-radius: 10px; margin-bottom: 16px; width: 100%; max-width: 100%; }
      .player-bar { padding: 8px 8px; gap: 8px; width: 100%; max-width: 100%; }
      .player-left { width: 100%; max-width: 100%; min-width: 0; margin-bottom: 2px; overflow: hidden; }
      .player-title { font-size: 13px; min-width: 0; flex: 1; }
      .player-controls { width: 100%; max-width: 100%; justify-content: flex-end; gap: 6px; }
      .source-switcher {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 2px 4px;
      }
      .source-label { display: none !important; }
      .btn-source {
        padding: 5px 8px;
        font-size: 11px;
        justify-content: center;
        text-align: center;
      }

      .section-title { font-size: 15px; margin: 18px 0 10px 0; width: 100%; max-width: 100%; overflow: hidden; }
      .section-hint { display: none !important; }
      .custom-tooltip { display: none !important; }
      .channel-grid {
        grid-template-columns: 100% !important;
        gap: 10px;
        margin-bottom: 20px;
        width: 100% !important;
        max-width: 100% !important;
        overflow: hidden;
      }
      .ch-card {
        padding: 10px 10px;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        overflow: hidden !important;
      }
      .ch-info { min-width: 0 !important; overflow: hidden !important; }
      .tooltip-wrapper { min-width: 0 !important; overflow: hidden !important; width: 100%; }
      .ch-name { font-size: 13px; min-width: 0; }
      .ch-logo { width: 42px; height: 42px; flex-shrink: 0; }

      .generator-card { padding: 12px 10px; margin-bottom: 20px; width: 100%; max-width: 100%; overflow: hidden; }
      .generator-card h3 { font-size: 14px; margin-bottom: 10px; }
      .filter-options { flex-direction: column; gap: 6px; width: 100%; max-width: 100%; }
      .filter-option { width: 100%; max-width: 100%; font-size: 12px; padding: 7px 10px; min-width: 0; }

      .url-item {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 10px 10px;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        overflow: hidden;
      }
      .url-info {
        min-width: 0;
        width: 100% !important;
        flex: none !important;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .url-name { font-size: 13px; }
      .url-actions {
        width: 100%;
        max-width: 100%;
        min-width: 0;
      }
      .url-box {
        font-size: 11px;
        padding: 7px 10px;
        min-width: 0;
      }
      .btn-copy {
        padding: 7px 12px;
        font-size: 11px;
      }
    }

    .toast { position: fixed; bottom: 20px; right: 20px; left: 20px; max-width: 360px; margin: 0 auto; text-align: center; background: #16a34a; color: #fff; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; display: none; box-shadow: 0 4px 16px rgba(0,0,0,0.6); z-index: 1000; }
    footer { text-align: center; margin-top: 30px; font-size: 12px; color: var(--text-dim); border-top: 1px solid var(--border); padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>⚽ IPTV THỂ THAO & BLV TIẾNG VIỆT</h1>
    </header>

    <!-- Web Player -->
    <div class="player-wrapper">
      <div class="video-container" id="videoContainer">
        <video id="videoPlayer" controls playsinline></video>
      </div>
      <div class="player-bar">
        <div class="player-left">
          <span id="playerBadge" class="player-tag tag-ready">CHỌN KÊNH</span>
          <span id="playerTitle" class="player-title">Bấm vào bất kỳ kênh nào bên dưới để xem trực tiếp</span>
        </div>
        <div class="player-controls">
          <div class="source-switcher" id="sourceSwitcher" style="display:none;">
            <span class="source-label">Source:</span>
            <button id="btnSrcHls" class="btn-source" onclick="switchSource('hls')">⚡ SV1 (HLS)</button>
            <button id="btnSrcFlv" class="btn-source" onclick="switchSource('flv')">🚀 SV2 (FLV)</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Play Grid (12 BLV Gà Vàng) -->
    <div class="section-title">
      <span>📺 Kênh Gà Vàng 33</span>
      <span class="section-hint" style="font-size:13px; color:var(--text-dim);">Hover để xem đầy đủ thông tin trận đấu</span>
    </div>
    <div class="channel-grid">
      ${blvList.map(ch => `
        <div id="card_${encodeURIComponent(ch.nickName)}" class="ch-card ${ch.isLive ? 'is-live' : (ch.isUpcoming ? 'is-upcoming' : '')}" onclick="playChannel('${ch.nickName.replace(/'/g, "\\'")}', 'hls')">
          <img class="ch-logo" src="${ch.logoUrl}" alt="${ch.nickName}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚽</text></svg>'">
          <div class="ch-info">
            <div class="tooltip-wrapper">
              <div class="ch-name">${ch.displayName}</div>
              <div class="custom-tooltip">
                <div class="tooltip-header" style="color:${ch.isLive ? 'var(--red)' : (ch.isUpcoming ? 'var(--amber)' : 'var(--text-dim)')}">
                  ${ch.isLive ? '🔴 ĐANG PHÁT TRỰC TIẾP' : (ch.isUpcoming ? '⏳ TRẬN ĐẤU SẮP DIỄN RA' : '💤 TRẠNG THÁI NGHỈ')}
                </div>
                <div class="tooltip-match">${ch.matchTitle || ch.displayName}</div>
                <div class="tooltip-extra">BLV: <b>${ch.nickName}</b> ${ch.timeStr ? `• Giờ lăn bóng: <b>${ch.timeStr}</b>` : ''}</div>
              </div>
            </div>
            <div class="ch-meta">
              <span class="badge-status ${ch.isLive ? 'tag-live' : (ch.isUpcoming ? 'tag-upcoming' : 'tag-ready')}">
                ${ch.isLive ? '🔴 LIVE' : (ch.isUpcoming ? '⏳ SẮP ĐÁ' : 'NGHỈ')}
              </span>
              <span>BLV ${ch.nickName}</span>
            </div>
          </div>
          <div class="ch-actions" onclick="event.stopPropagation()">
            <button class="btn-ch-play btn-ch-hls" onclick="playChannel('${ch.nickName.replace(/'/g, "\\'")}', 'hls')" title="Xem luồng HLS (.m3u8)">▶ HLS</button>
            <button class="btn-ch-play btn-ch-flv" onclick="playChannel('${ch.nickName.replace(/'/g, "\\'")}', 'flv')" title="Xem luồng FLV (.flv)">▶ FLV</button>
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
      </div>

      <div id="linksContainer">
        ${endpoints.map(ep => `
          <div class="url-item">
            <div class="url-info">
              <span class="url-name">${ep.title}</span>
              <span class="url-badge">${ep.count}</span>
            </div>
            <div class="url-actions">
              <div class="url-box" id="url_${ep.name}">${host}${ep.path}</div>
              <button class="btn-copy" onclick="copyLink('url_${ep.name}', this)">Sao Chép</button>
            </div>
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
    const CHANNELS_MAP = ${JSON.stringify(blvList.reduce((acc, c) => { acc[c.nickName] = c; return acc; }, {}))};
    let currentNick = null;
    let currentSource = "hls";
    let hlsInstance = null;
    let mpegtsInstance = null;

    const video = document.getElementById("videoPlayer");
    const pTitle = document.getElementById("playerTitle");
    const pBadge = document.getElementById("playerBadge");
    const switcher = document.getElementById("sourceSwitcher");
    const btnHls = document.getElementById("btnSrcHls");
    const btnFlv = document.getElementById("btnSrcFlv");

    function playChannel(nick, source) {
      currentNick = nick;
      currentSource = source || "hls";
      const ch = CHANNELS_MAP[nick];
      if (!ch) return;

      document.querySelectorAll('.ch-card').forEach(c => c.classList.remove('is-playing'));
      const activeCard = document.getElementById('card_' + encodeURIComponent(nick));
      if (activeCard) activeCard.classList.add('is-playing');

      switcher.style.display = "flex";
      pTitle.innerText = ch.displayName;

      if (ch.isLive) {
        pBadge.className = "player-tag tag-live";
        pBadge.innerText = "TRỰC TIẾP";
      } else if (ch.isUpcoming) {
        pBadge.className = "player-tag tag-upcoming";
        pBadge.innerText = "SẮP ĐÁ";
      } else {
        pBadge.className = "player-tag tag-ready";
        pBadge.innerText = "SẴN SÀNG";
      }

      document.querySelector(".player-wrapper").scrollIntoView({ behavior: "smooth" });
      loadStream(currentSource);
    }

    function switchSource(source) {
      if (!currentNick) return;
      currentSource = source;
      loadStream(currentSource);
    }

    function loadStream(source) {
      const ch = CHANNELS_MAP[currentNick];
      if (!ch) return;

      btnHls.className = "btn-source" + (source === "hls" ? " active" : "");
      btnFlv.className = "btn-source" + (source === "flv" ? " active" : "");

      // Cleanup previous players
      if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
      if (mpegtsInstance) { mpegtsInstance.destroy(); mpegtsInstance = null; }
      video.pause();
      video.removeAttribute("src");

      const streamUrl = source === "flv" ? ch.flv_url : ch.hls_url;

      if (source === "flv") {
        if (typeof mpegts !== "undefined" && mpegts.getFeatureList().mseLivePlayback) {
          mpegtsInstance = mpegts.createPlayer({
            type: "flv",
            isLive: true,
            url: streamUrl
          });
          mpegtsInstance.attachMediaElement(video);
          mpegtsInstance.load();
          mpegtsInstance.play().catch(e => console.warn("Autoplay blocked:", e));
        } else {
          alert("Trình duyệt này không hỗ trợ phát FLV trực tiếp qua MSE (như Safari/iOS). Đang tự động chuyển sang HLS!");
          switchSource("hls");
        }
      } else {
        // HLS
        if (typeof Hls !== "undefined" && Hls.isSupported()) {
          hlsInstance = new Hls({ enableWorker: true });
          hlsInstance.loadSource(streamUrl);
          hlsInstance.attachMedia(video);
          hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(e => console.warn("Autoplay blocked:", e));
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = streamUrl;
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

      const params = [];
      if (isLive) params.push("live_only=true");
      if (isHls) params.push("type=hls");
      if (isFlv) params.push("type=flv");

      const query = params.length > 0 ? "?" + params.join("&") : "";
      const baseEndpoints = ${JSON.stringify(endpoints)};
      
      baseEndpoints.forEach(ep => {
        const el = document.getElementById("url_" + ep.name);
        if (el) {
          el.innerText = "${host}" + ep.path + query;
        }
      });
    }

    // Toast notification
    function showToast(msg) {
      const toast = document.getElementById("toast");
      if (!toast) return;
      toast.innerText = msg || "Đã sao chép link!";
      toast.style.display = "block";
      clearTimeout(window.toastTimer);
      window.toastTimer = setTimeout(() => {
        toast.style.display = "none";
      }, 2000);
    }

    // Bulletproof copy function across desktop & mobile
    async function copyToClipboard(text) {
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch (e) {
          console.warn("navigator.clipboard failed, attempting fallback:", e);
        }
      }
      return new Promise((resolve, reject) => {
        try {
          const textArea = document.createElement("textarea");
          textArea.value = text;
          textArea.style.position = "fixed";
          textArea.style.top = "0";
          textArea.style.left = "-9999px";
          textArea.style.opacity = "0";
          textArea.setAttribute("readonly", "");
          document.body.appendChild(textArea);

          if (navigator.userAgent.match(/ipad|ipod|iphone/i)) {
            const range = document.createRange();
            range.selectNodeContents(textArea);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            textArea.setSelectionRange(0, 999999);
          } else {
            textArea.select();
            textArea.setSelectionRange(0, 999999);
          }

          const successful = document.execCommand("copy");
          document.body.removeChild(textArea);
          if (successful) resolve(true);
          else reject(new Error("execCommand failed"));
        } catch (err) {
          reject(err);
        }
      });
    }

    function copyLink(id, btn) {
      const el = document.getElementById(id);
      if (!el) return;
      const text = el.innerText.trim();

      copyToClipboard(text).then(() => {
        showToast("✓ Đã sao chép link IPTV thành công!");
        if (btn) {
          const originalText = btn.innerText;
          btn.innerText = "✓ Đã chép!";
          btn.classList.add("copied");
          setTimeout(() => {
            btn.innerText = originalText;
            btn.classList.remove("copied");
          }, 1800);
        }
      }).catch(() => {
        window.prompt("Sao chép link thủ công bên dưới:", text);
      });
    }

    // Prevent double-click zoom on mobile body
    document.addEventListener("dblclick", function(e) {
      if (e.target.closest("#videoContainer") || e.target.closest("video")) return;
      e.preventDefault();
    }, { passive: false });

    // Silent Background Fullscreen / Expand Handler (No UI buttons or popups)
    function toggleFullscreen() {
      const container = document.getElementById("videoContainer");
      const video = document.getElementById("videoPlayer");
      const isFs = document.fullscreenElement || 
                   document.webkitFullscreenElement || 
                   document.mozFullScreenElement || 
                   document.msFullscreenElement ||
                   (video && video.webkitDisplayingFullscreen);

      if (!isFs) {
        if (container && container.requestFullscreen) {
          container.requestFullscreen().catch(() => {
            if (video && video.webkitEnterFullscreen) video.webkitEnterFullscreen();
            else if (video && video.requestFullscreen) video.requestFullscreen();
          });
        } else if (video && video.webkitEnterFullscreen) {
          video.webkitEnterFullscreen();
        } else if (container && container.webkitRequestFullscreen) {
          container.webkitRequestFullscreen();
        } else if (video && video.requestFullscreen) {
          video.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (video && video.webkitExitFullscreen) {
          video.webkitExitFullscreen();
        }
      }
    }

    // Handle double-click & double-tap on video player quietly in background
    const vContainer = document.getElementById("videoContainer");
    if (vContainer) {
      // Desktop double click
      vContainer.addEventListener("dblclick", function(e) {
        e.preventDefault();
        toggleFullscreen();
      });

      // Mobile double tap
      let lastVideoTapTime = 0;
      vContainer.addEventListener("touchend", function(e) {
        const now = Date.now();
        const diff = now - lastVideoTapTime;
        if (diff > 40 && diff < 320) {
          e.preventDefault();
          toggleFullscreen();
          lastVideoTapTime = 0;
        } else {
          lastVideoTapTime = now;
        }
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
    const filterOptions = { liveOnly: isLiveOnly, type: streamType };

    // 3. Cloudflare Edge Cache Check
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

    const { sv1, sv2, combined } = buildGavangChannels(blvList, liveMap, upcomingMap, AVATAR_BASE);

    // 5. Handle Web Dashboard
    if (path === "/" || path === "/index.html") {
      // Sort combined commentators with priority Live -> Non-live (rank is handled internally, no rank text displayed)
      const sortedCombined = sortChannels(combined);
      const html = renderDashboard(host, liveMap, upcomingMap, sortedCombined, envConfig);
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
        finalChannels = filterChannels(sortChannels(sv1), filterOptions);
      } else if (path === "/gv_sv2" || path === "/gv_sv2.m3u") {
        playlistTitle = "⚽ GÀ VÀNG 33 - SERVER 2 FLV";
        finalChannels = filterChannels(sortChannels(sv2), filterOptions);
      } else {
        playlistTitle = "⚽ GÀ VÀNG 33 (SV1 & SV2)";
        const sortedSv1 = filterChannels(sortChannels(sv1), filterOptions);
        const sortedSv2 = filterChannels(sortChannels(sv2), filterOptions);
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
            updatedExtinf = updatedExtinf.replace(regex, `, ${info.title}`);
            isLive = true;
            break;
          }
        }

        // Check upcoming in 6h if not live
        if (!isLive) {
          for (const [nick, info] of Object.entries(upcomingMap)) {
            if (updatedExtinf.includes(nick)) {
              const regex = new RegExp(`,\\s*(BLV\\s+)?${nick}\\b`, "g");
              updatedExtinf = updatedExtinf.replace(regex, `, [${info.timeStr}] ${info.title}`);
              isUpcoming = true;
              break;
            }
          }
        }

        return { ...c, extinf: updatedExtinf, isLive, isUpcoming, rank: idx + 1 };
      });

      // Pure internal priority sorting: Live first -> Non-live
      selectedChannels = filterChannels(sortChannels(selectedChannels), filterOptions);

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
