# -*- coding: utf-8 -*-
"""
IPTV Playlist Generator
Processes sports commentator streams and outputs standard M3U playlists and Direct Files:
- Master: sport.m3u, sport (137 channels)
- Categories: cola, gavang33, gavang24, khandai, xoiche (.m3u & Direct Files)
- Gà Vàng 33 Servers: gv (SV1 & SV2 combo), gv_sv1 (HLS), gv_sv2 (FLV) with dynamic match updates and local avatars
"""

import os
import sys
import json
import ssl
import time
import urllib.request

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Internal paths
BASE_CHANNELS_PATH = os.path.join("sources", "base_channels.m3u")
GAVANG_FIXED_CONFIG = os.path.join("sources", "gavang33_fixed.json")
GAVANG_CACHE_FILE = os.path.join("sources", "gavang_cache.json")

# URLs & Settings
GAVANG_API_URL = "https://gavangtv-api.adviceme.io/api/v1/matches?webType=gavang"
RAW_GITHUB_AVATAR_BASE = "https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/assets/blv"
DEFAULT_EPG = "https://lichphatsong.io.vn/epg.xml"
DEFAULT_UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

# Target commentator groups
BLV_GROUPS = [
    "🔴 ⚽ COLA TV",
    "🔴 ⚽ 🏀 COLA TV SV2",
    "🔴 ⚽ 🏀 COLA TV SV3",
    "🔴 ⚽ GÀ VÀNG 33",
    "🔴 ⚽ GÀ VÀNG 33 SV2",
    "🔴 ⚽ 🏐 KHÁN ĐÀI TV",
    "🔴 ⚽ 🏐 GÀ VÀNG 24h",
    "🔴 ⚽ 🏐 XÔI CHÈ TV"
]

def get_ssl_context():
    """Returns an unverified SSL context for compatibility across environments."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

def load_base_channels():
    """Loads base channels from internal storage."""
    target_path = BASE_CHANNELS_PATH if os.path.exists(BASE_CHANNELS_PATH) else "sport.m3u"
    if not os.path.exists(target_path):
        print(f"Error: {target_path} not found.")
        sys.exit(1)

    with open(target_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()
        print(f"Loaded base channels from {target_path} ({len(content)} bytes).")
        return content

def extract_blv_channels(raw_text):
    """Parses M3U text and extracts channels matching BLV_GROUPS."""
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    channels = []
    i = 0

    while i < len(lines):
        line = lines[i]
        if line.startswith("#EXTINF"):
            extinf = line
            opts = []
            url = None
            i += 1
            while i < len(lines) and not lines[i].startswith("#EXTINF"):
                sub_line = lines[i]
                if sub_line.startswith("#"):
                    opts.append(sub_line)
                else:
                    url = sub_line
                i += 1
            if url and any(grp in extinf for grp in BLV_GROUPS):
                channels.append({
                    "extinf": extinf,
                    "opts": opts,
                    "url": url
                })
        else:
            i += 1

    return channels

def write_playlist_files(base_name, playlist_title, channels):
    """Writes both standard M3U (.m3u) and Direct File (no extension)."""
    m3u_file = f"{base_name}.m3u"
    direct_file = f"{base_name}"
    header = f'#EXTM3U name="{playlist_title}" url-tvg="{DEFAULT_EPG}"'

    content_lines = [header]
    for ch in channels:
        content_lines.append(ch["extinf"])
        content_lines.append(f"#EXTVLCOPT:http-user-agent={DEFAULT_UA}")
        for opt in ch.get("opts", []):
            if "http-user-agent" not in opt.lower():
                content_lines.append(opt)
        content_lines.append(ch["url"])

    full_text = "\n".join(content_lines) + "\n"

    with open(m3u_file, "w", encoding="utf-8") as f:
        f.write(full_text)
    with open(direct_file, "w", encoding="utf-8") as f:
        f.write(full_text)

    print(f"Generated: {m3u_file} & {direct_file} ({len(channels)} channels)")

def load_fixed_blv_list():
    """Loads fixed baseline configuration for Gà Vàng 33 commentators."""
    if os.path.exists(GAVANG_FIXED_CONFIG):
        with open(GAVANG_FIXED_CONFIG, "r", encoding="utf-8") as f:
            return json.load(f)
    print(f"Error: {GAVANG_FIXED_CONFIG} missing.")
    return []

def get_live_matches_from_api_or_cache():
    """
    Fetches live match titles for commentators from API with retry and fallback cache.
    Reverts to commentator name if match has ended (TTL: 120 minutes).
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://gavang33.ac"
    }
    req = urllib.request.Request(GAVANG_API_URL, headers=headers)
    matches_data = None

    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, context=get_ssl_context(), timeout=15) as r:
                data = json.loads(r.read().decode("utf-8"))
                matches_data = data.get("data", {})
                print(f"Fetched Gà Vàng API ({len(matches_data)} matches).")
                break
        except Exception as e:
            if attempt == 0:
                time.sleep(1)
            else:
                print(f"Warning: API unavailable ({e}). Using cache.")

    now_ts = time.time()
    live_map = {}

    if matches_data is not None:
        cache_records = {}
        for m in matches_data.values():
            if m.get("matchStatus") == "live":
                home = (m.get("homeTeam") or {}).get("name", "").strip()
                away = (m.get("awayTeam") or {}).get("name", "").strip()
                title = f"{home} vs {away}".strip() if (home and away) else (m.get("canonicalMatchId") or "Trận Đấu Trực Tiếp")
                m_time = m.get("matchTime") or now_ts
                anchors = m.get("anchorAppointmentVoList") or []
                for a in anchors:
                    nick = (a.get("nickName") or "").strip()
                    if nick:
                        live_map[nick] = title
                        cache_records[nick] = {
                            "title": title,
                            "matchTime": m_time,
                            "cached_at": now_ts
                        }
        try:
            os.makedirs("sources", exist_ok=True)
            with open(GAVANG_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump({"saved_at": now_ts, "matches": cache_records}, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Warning: Cache save error ({e}).")

    elif os.path.exists(GAVANG_CACHE_FILE):
        try:
            with open(GAVANG_CACHE_FILE, "r", encoding="utf-8") as f:
                cache_content = json.load(f)
            saved_at = cache_content.get("saved_at", 0)
            cache_matches = cache_content.get("matches", {})
            if now_ts - saved_at < 21600:
                for nick, record in cache_matches.items():
                    m_time = record.get("matchTime", 0)
                    if m_time and (now_ts - m_time <= 7200):
                        live_map[nick] = record.get("title")
                print(f"Cache active: {len(live_map)} live matches restored.")
        except Exception as e:
            print(f"Cache read error ({e}).")

    return live_map

def build_gv_servers():
    """Builds gv_sv1 (HLS) and gv_sv2 (FLV) channels with fixed order and local avatars."""
    fixed_blvs = load_fixed_blv_list()
    live_map = get_live_matches_from_api_or_cache()

    sv1_channels = []
    sv2_channels = []

    for b in fixed_blvs:
        nick = b["nickName"]
        logo_url = f"{RAW_GITHUB_AVATAR_BASE}/{b['logo_filename']}"
        live_title = live_map.get(nick)
        display_name = live_title if live_title else f"BLV {nick}"

        sv1_channels.append({
            "extinf": f'#EXTINF:-1 group-title="🔴 ⚽ GÀ VÀNG 33" tvg-logo="{logo_url}", {display_name}',
            "opts": [],
            "url": b["hls_url"]
        })
        sv2_channels.append({
            "extinf": f'#EXTINF:-1 group-title="🔴 ⚽ GÀ VÀNG 33 SV2" tvg-logo="{logo_url}", {display_name}',
            "opts": [],
            "url": b["flv_url"]
        })

    return sv1_channels, sv2_channels

def generate_playlists():
    """Main workflow to generate all playlists and direct files."""
    raw_content = load_base_channels()
    upstream_channels = extract_blv_channels(raw_content)
    print(f"Extracted {len(upstream_channels)} baseline channels.")

    # 1. Master Playlists
    write_playlist_files("sport", "⚽ THỂ THAO & BLV TIẾNG VIỆT", upstream_channels)

    # 2. Category Playlists
    cola_channels = [c for c in upstream_channels if "COLA TV" in c["extinf"]]
    gavang33_channels = [c for c in upstream_channels if "GÀ VÀNG 33" in c["extinf"]]
    gavang24_channels = [c for c in upstream_channels if "GÀ VÀNG 24h" in c["extinf"]]
    khandai_channels = [c for c in upstream_channels if "KHÁN ĐÀI TV" in c["extinf"]]
    xoiche_channels = [c for c in upstream_channels if "XÔI CHÈ TV" in c["extinf"]]

    write_playlist_files("cola", "⚽ COLA TV (BLV Tiếng Việt)", cola_channels)
    write_playlist_files("gavang33", "⚽ GÀ VÀNG 33 (BLV Tiếng Việt)", gavang33_channels)
    write_playlist_files("gavang24", "⚽ GÀ VÀNG 24H (BLV Tiếng Việt)", gavang24_channels)
    write_playlist_files("khandai", "⚽ KHÁN ĐÀI TV (BLV Tiếng Việt)", khandai_channels)
    write_playlist_files("xoiche", "⚽ XÔI CHÈ TV (BLV Tiếng Việt)", xoiche_channels)

    # 3. Dedicated Gà Vàng 33 Servers
    gv_sv1, gv_sv2 = build_gv_servers()
    write_playlist_files("gv_sv1", "⚽ GÀ VÀNG 33 - SERVER 1 HLS", gv_sv1)
    write_playlist_files("gv_sv2", "⚽ GÀ VÀNG 33 - SERVER 2 FLV", gv_sv2)
    write_playlist_files("gv", "⚽ GÀ VÀNG 33 (SV1 & SV2)", gv_sv1 + gv_sv2)

    print("\nAll playlists and Direct Files generated successfully.")

if __name__ == "__main__":
    generate_playlists()
