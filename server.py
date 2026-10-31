# -*- coding: utf-8 -*-
"""
Local IPTV Playlist Server
Runs a lightweight HTTP server to serve Sports BLV playlists to your IPTV apps
(TiviMate, OTT Navigator, Televizo, VLC, etc.) within your home Wi-Fi/LAN.
"""

import http.server
import socket
import socketserver
import os

PORT = 8080

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

class IPTVHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            ip = get_local_ip()
            html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>⚽ Thể Thao BLV Tiếng Việt Server</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; background: #0f172a; color: #f8fafc; }}
        h1 {{ color: #38bdf8; border-bottom: 2px solid #334155; padding-bottom: 10px; }}
        .card {{ background: #1e293b; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #334155; }}
        .url {{ font-family: monospace; background: #0f172a; padding: 8px 12px; border-radius: 4px; color: #4ade80; display: block; word-break: break-all; margin: 8px 0; }}
        a {{ color: #38bdf8; text-decoration: none; }}
        a:hover {{ text-decoration: underline; }}
        .badge {{ background: #0284c7; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; }}
    </style>
</head>
<body>
    <h1>⚽ THỂ THAO & BÌNH LUẬN VIÊN TIẾNG VIỆT</h1>
    <p>Server đang phát trong mạng nội bộ. Copy đường link dưới đây dán vào TiviMate, OTT Navigator hoặc VLC:</p>
    
    <div class="card">
        <h3>⚽ 1. Thể Thao BLV (TiviMate / OTT Navigator) <span class="badge">Khuyên Dùng</span></h3>
        <p>Gắn kèm User-Agent định dạng pipe syntax <code>|User-Agent=...</code> tương thích hoàn hảo với Android TV Box.</p>
        <span class="url">http://{ip}:{PORT}/sport_tivimate.m3u</span>
        <a href="/sport_tivimate.m3u" download>Tải file .m3u</a>
    </div>

    <div class="card">
        <h3>⚽ 2. Thể Thao BLV (VLC Media Player / Tiêu chuẩn)</h3>
        <p>Chuẩn M3U tiêu chuẩn với thẻ <code>#EXTVLCOPT</code>.</p>
        <span class="url">http://{ip}:{PORT}/sport.m3u</span>
        <a href="/sport.m3u" download>Tải file .m3u</a>
    </div>

    <div class="card">
        <h3>⚽ 3. Định dạng không đuôi (Direct File)</h3>
        <p>Chuẩn link không có đuôi mở rộng <code>sport</code>.</p>
        <span class="url">http://{ip}:{PORT}/sport</span>
        <a href="/sport" download>Tải file sport</a>
    </div>
</body>
</html>"""
            self.wfile.write(html.encode("utf-8"))
            return
        super().do_GET()

def run():
    ip = get_local_ip()
    handler = IPTVHandler
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print("=" * 60)
        print("📺 IPTV Sports BLV Local Server is running!")
        print(f"👉 LAN Web UI   : http://{ip}:{PORT}")
        print("-" * 60)
        print("CÁC LINK M3U ĐỂ ADD VÀO IPTV (Cùng mạng Wi-Fi):")
        print(f"1. TiviMate / OTT Navigator : http://{ip}:{PORT}/sport_tivimate.m3u")
        print(f"2. VLC / Chuẩn M3U          : http://{ip}:{PORT}/sport.m3u")
        print(f"3. Direct File (sport)      : http://{ip}:{PORT}/sport")
        print("=" * 60)
        print("Nhấn Ctrl + C để dừng server.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    run()
