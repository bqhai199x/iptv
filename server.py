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
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 900px; margin: 40px auto; padding: 20px; line-height: 1.6; background: #0f172a; color: #f8fafc; }}
        h1 {{ color: #38bdf8; border-bottom: 2px solid #334155; padding-bottom: 10px; }}
        h2 {{ color: #f59e0b; margin-top: 30px; border-bottom: 1px solid #334155; padding-bottom: 6px; }}
        .card {{ background: #1e293b; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #334155; }}
        .url {{ font-family: monospace; background: #0f172a; padding: 8px 12px; border-radius: 4px; color: #4ade80; display: block; word-break: break-all; margin: 6px 0; font-size: 13px; }}
        a {{ color: #38bdf8; text-decoration: none; font-size: 13px; margin-right: 15px; }}
        a:hover {{ text-decoration: underline; }}
        .badge {{ background: #0284c7; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; }}
        .badge-cat {{ background: #10b981; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; }}
        .badge-flv {{ background: #f97316; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; }}
    </style>
</head>
<body>
    <h1>⚽ THỂ THAO & BÌNH LUẬN VIÊN TIẾNG VIỆT</h1>
    <p>Server đang phát trong mạng nội bộ. Copy đường link dưới đây dán vào TiviMate, OTT Navigator hoặc VLC:</p>
    
    <h2>📦 1. NGUỒN TỔNG HỢP (137 KÊNH)</h2>
    <div class="card">
        <h3>⚽ Thể Thao BLV (Chuẩn M3U & Direct File)</h3>
        <p>Chuẩn M3U tiêu chuẩn kèm cờ User-Agent phù hợp với tất cả ứng dụng IPTV.</p>
        <span class="url">http://{ip}:{PORT}/sport.m3u</span>
        <a href="/sport.m3u" download>Tải file sport.m3u</a>
        <a href="/sport" download>Direct File (sport)</a>
    </div>

    <h2>🐔 2. GÀ VÀNG 33 (SERVER 1 & SERVER 2)</h2>
    <div class="card">
        <h3>🔴 ⚽ GÀ VÀNG 33 - GỘP 2 SERVER (gv) <span class="badge">24 kênh (HLS & FLV)</span></h3>
        <p>Gộp toàn bộ 24 kênh của Server 1 và Server 2, giữ nguyên xếp hạng, logo BLV và tên trận đấu live.</p>
        <span class="url">http://{ip}:{PORT}/gv.m3u</span>
        <a href="/gv.m3u" download>Tải file .m3u</a>
        <a href="/gv" download>Direct File (không đuôi)</a>
    </div>

    <div class="card">
        <h3>🔴 ⚽ GÀ VÀNG 33 - SERVER 1 (gv_sv1) <span class="badge-cat">12 kênh HLS</span></h3>
        <p>Danh sách 12 kênh HLS theo bảng xếp hạng, logo BLV nội bộ và tự động hiển thị tên trận đấu khi phát sóng trực tiếp.</p>
        <span class="url">http://{ip}:{PORT}/gv_sv1.m3u</span>
        <a href="/gv_sv1.m3u" download>Tải file .m3u</a>
        <a href="/gv_sv1" download>Direct File (không đuôi)</a>
    </div>

    <div class="card">
        <h3>🔴 ⚽ GÀ VÀNG 33 - SERVER 2 (gv_sv2) <span class="badge-flv">12 kênh FLV</span></h3>
        <p>Danh sách 12 kênh FLV theo bảng xếp hạng, logo BLV nội bộ và tự động hiển thị tên trận đấu khi phát sóng trực tiếp.</p>
        <span class="url">http://{ip}:{PORT}/gv_sv2.m3u</span>
        <a href="/gv_sv2.m3u" download>Tải file .m3u</a>
        <a href="/gv_sv2" download>Direct File (không đuôi)</a>
    </div>

    <h2>📺 3. DANH MỤC PHÂN THEO ĐÀI</h2>
    <div class="card">
        <h3>🔴 ⚽ GÀ VÀNG 33 <span class="badge-cat">21 kênh</span></h3>
        <p>Bao gồm các kênh Gà Vàng 33 (Server 1 & Server 2) từ nguồn cơ sở.</p>
        <span class="url">http://{ip}:{PORT}/gavang33.m3u</span>
        <a href="/gavang33.m3u" download>Tải file .m3u</a>
        <a href="/gavang33" download>Direct File (không đuôi)</a>
    </div>

    <div class="card">
        <h3>🔴 ⚽ 🏐 GÀ VÀNG 24H <span class="badge-cat">18 kênh</span></h3>
        <span class="url">http://{ip}:{PORT}/gavang24.m3u</span>
        <a href="/gavang24.m3u" download>Tải file .m3u</a>
        <a href="/gavang24" download>Direct File (không đuôi)</a>
    </div>

    <div class="card">
        <h3>🔴 ⚽ COLA TV (SV1, SV2, SV3) <span class="badge-cat">79 kênh</span></h3>
        <span class="url">http://{ip}:{PORT}/cola.m3u</span>
        <a href="/cola.m3u" download>Tải file .m3u</a>
        <a href="/cola" download>Direct File (không đuôi)</a>
    </div>

    <div class="card">
        <h3>🔴 ⚽ 🏐 KHÁN ĐÀI TV <span class="badge-cat">10 kênh</span></h3>
        <span class="url">http://{ip}:{PORT}/khandai.m3u</span>
        <a href="/khandai.m3u" download>Tải file .m3u</a>
        <a href="/khandai" download>Direct File (không đuôi)</a>
    </div>

    <div class="card">
        <h3>🔴 ⚽ 🏐 XÔI CHÈ TV <span class="badge-cat">9 kênh</span></h3>
        <span class="url">http://{ip}:{PORT}/xoiche.m3u</span>
        <a href="/xoiche.m3u" download>Tải file .m3u</a>
        <a href="/xoiche" download>Direct File (không đuôi)</a>
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
        print("CÁC LINK M3U / DIRECT FILE (Cùng mạng Wi-Fi):")
        print(f"1. Tổng Hợp (Chuẩn M3U)      : http://{ip}:{PORT}/sport.m3u  (Direct: /sport)")
        print(f"2. Gà Vàng 33 Gộp (gv)       : http://{ip}:{PORT}/gv.m3u  (Direct: /gv)")
        print(f"3. Gà Vàng 33 SV1 (gv_sv1)   : http://{ip}:{PORT}/gv_sv1.m3u  (Direct: /gv_sv1)")
        print(f"4. Gà Vàng 33 SV2 (gv_sv2)   : http://{ip}:{PORT}/gv_sv2.m3u  (Direct: /gv_sv2)")
        print(f"5. Gà Vàng 33 (21 kênh)      : http://{ip}:{PORT}/gavang33.m3u  (Direct: /gavang33)")
        print(f"6. Gà Vàng 24H (18 kênh)     : http://{ip}:{PORT}/gavang24.m3u  (Direct: /gavang24)")
        print(f"7. COLA TV (79 kênh)         : http://{ip}:{PORT}/cola.m3u  (Direct: /cola)")
        print(f"8. KHÁN ĐÀI TV (10 kênh)     : http://{ip}:{PORT}/khandai.m3u  (Direct: /khandai)")
        print(f"9. XÔI CHÈ TV (9 kênh)       : http://{ip}:{PORT}/xoiche.m3u  (Direct: /xoiche)")
        print("=" * 60)
        print("Nhấn Ctrl + C để dừng server.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    run()
