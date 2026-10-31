# -*- coding: utf-8 -*-
"""
Script to fetch and generate Vietnamese Sports BLV Playlists:
- sport.m3u: Standard M3U playlist with #EXTVLCOPT
- sport_tivimate.m3u: Pipe syntax (|User-Agent=...) for TiviMate, OTT Navigator, Kodi
- sport: No-extension file for direct raw URLs (e.g. .../main/sport)
"""

import urllib.request
import re
import os
import sys

# Remote feed source (used only to extract fresh BLV streaming URLs)
FEED_SOURCE_URL = "https://raw.githubusercontent.com/vuminhthanh12/vuminhthanh12/refs/heads/main/vmttv"
DEFAULT_EPG = "https://lichphatsong.io.vn/epg.xml"
DEFAULT_UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

# ONLY Vietnamese Commentator (BLV) Sports Groups
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

def fetch_feed():
    headers = {"User-Agent": DEFAULT_UA}
    req = urllib.request.Request(FEED_SOURCE_URL, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            content = resp.read().decode("utf-8", errors="replace")
            print(f"Fetched upstream feed ({len(content)} bytes).")
            return content
    except Exception as e:
        print(f"Warning: Could not fetch remote feed ({e}). Checking local backup...")
        if os.path.exists("sport.m3u"):
            with open("sport.m3u", "r", encoding="utf-8", errors="replace") as f:
                return f.read()
        return None

def extract_blv_channels(raw_text):
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
            # Strict filter: ONLY keep Vietnamese BLV groups
            is_blv = any(grp in extinf for grp in BLV_GROUPS)
            if url and is_blv:
                channels.append({
                    "extinf": extinf,
                    "opts": opts,
                    "url": url
                })
        else:
            i += 1
            
    return channels

def generate_playlists():
    raw_content = fetch_feed()
    if not raw_content:
        print("Error: No feed content available.")
        sys.exit(1)

    channels = extract_blv_channels(raw_content)
    print(f"Extracted {len(channels)} Vietnamese BLV channels.")
    if len(channels) == 0:
        print("Error: No BLV channels found. Aborting to prevent overwriting.")
        sys.exit(1)

    header = f'#EXTM3U name="⚽ THỂ THAO & BLV TIẾNG VIỆT" url-tvg="{DEFAULT_EPG}"'

    # 1. Generate sport.m3u (Universal Standard M3U)
    with open("sport.m3u", "w", encoding="utf-8") as f:
        f.write(f"{header}\n")
        for ch in channels:
            f.write(f'{ch["extinf"]}\n')
            f.write(f'#EXTVLCOPT:http-user-agent={DEFAULT_UA}\n')
            for opt in ch["opts"]:
                if "http-user-agent" not in opt.lower():
                    f.write(f'{opt}\n')
            f.write(f'{ch["url"]}\n')
    print("Generated: sport.m3u")

    # 2. Generate sport_tivimate.m3u (Pipe syntax for TiviMate, OTT Navigator, Kodi)
    with open("sport_tivimate.m3u", "w", encoding="utf-8") as f:
        f.write(f'#EXTM3U name="⚽ THỂ THAO & BLV (TiviMate/Kodi)" url-tvg="{DEFAULT_EPG}"\n')
        for ch in channels:
            f.write(f'{ch["extinf"]}\n')
            f.write(f'#EXTVLCOPT:http-user-agent={DEFAULT_UA}\n')
            url = ch["url"]
            if "|" not in url:
                url = f"{url}|User-Agent={DEFAULT_UA}"
            f.write(f'{url}\n')
    print("Generated: sport_tivimate.m3u")

    # 3. Generate sport (No-extension file matching raw URL .../main/sport)
    with open("sport", "w", encoding="utf-8") as f:
        f.write(f"{header}\n")
        for ch in channels:
            f.write(f'{ch["extinf"]}\n')
            f.write(f'#EXTVLCOPT:http-user-agent={DEFAULT_UA}\n')
            for opt in ch["opts"]:
                if "http-user-agent" not in opt.lower():
                    f.write(f'{opt}\n')
            f.write(f'{ch["url"]}\n')
    print("Generated: sport")

if __name__ == "__main__":
    generate_playlists()
