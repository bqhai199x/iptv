# ⚽ IPTV THỂ THAO & BÌNH LUẬN VIÊN TIẾNG VIỆT

Tổng hợp các luồng phát trực tiếp Thể thao & Bình luận viên (BLV) tiếng Việt chất lượng cao. Hỗ trợ đầy đủ định dạng **M3U (`.m3u`)** và **Direct File (không đuôi)** tối ưu cho các thiết bị Android TV Box, Smart TV, điện thoại và máy tính.

> [!TIP]
> ⚡ **Khuyên dùng Cloudflare Worker (Real-time 100% & Miễn phí)**  
> Để tên trận đấu (`Arsenal vs Chelsea`, `Man Utd vs Liverpool`...) được tự động cập nhật ngay khi BLV lên sóng mà không cần chờ GitHub Actions, hãy xem hướng dẫn tại [**`cloudflare/README.md`**](cloudflare/README.md).

---

## 📑 Mục Lục

1. [Danh Sách Link Nguồn](#-1-danh-sách-link-nguồn)
2. [Triển Khai Cloudflare Worker (Khuyên dùng)](#-2-triển-khai-cloudflare-worker-khuyên-dùng)
3. [Hướng Dẫn Cài Đặt Vào Ứng Dụng](#-3-hướng-dẫn-cài-đặt-vào-ứng-dụng)
   - [TiviMate IPTV (Android TV)](#1-tivimate-iptv-android-tv)
   - [OTT Navigator IPTV](#2-ott-navigator-iptv)
   - [VLC Media Player](#3-vlc-media-player)
   - [Chạy Server Mạng Nội Bộ (LAN)](#4-chạy-server-mạng-nội-bộ-lan)
4. [Lưu Ý Về Định Dạng Luồng (HLS & FLV)](#-4-lưu-ý-về-định-dạng-luồng-hls--flv)
5. [Cấu Trúc Thư Mục](#-5-cấu-trúc-thư-mục)
6. [Miễn Trừ Trách Nhiệm](#-6-miễn-trừ-trách-nhiệm)

---

## 🔗 1. DANH SÁCH LINK NGUỒN

*(Nhấp chuột phải hoặc nhấn giữ vào link để chọn **Sao chép địa chỉ liên kết / Copy link address**)*

| Tên Danh Mục | Số Kênh | Giao Thức | Link M3U (`.m3u`) | Direct File (Không đuôi) |
| :--- | :---: | :---: | :---: | :---: |
| **⚽ Tổng Hợp BLV** | 137 | HLS / FLV | [`sport.m3u`](https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/sport.m3u) | [`sport`](https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/sport) |
| **🐔 Gà Vàng 33 (Gộp SV1 + SV2)** | 24 | HLS + FLV | [`gv.m3u`](https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gv.m3u) | [`gv`](https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gv) |
| **🐔 Gà Vàng 33 (Server 1)** | 12 | HLS | [`gv_sv1.m3u`](https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gv_sv1.m3u) | [`gv_sv1`](https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gv_sv1) |
| **🐔 Gà Vàng 33 (Server 2)** | 12 | FLV | [`gv_sv2.m3u`](https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gv_sv2.m3u) | [`gv_sv2`](https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gv_sv2) |
| **🥤 Cola TV** | 79 | HLS / FLV | [`cola.m3u`](https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/cola.m3u) | [`cola`](https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/cola) |
| **🐔 Gà Vàng 33 (Gốc)** | 21 | HLS / FLV | [`gavang33.m3u`](https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gavang33.m3u) | [`gavang33`](https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gavang33) |
| **🐔 Gà Vàng 24H** | 18 | FLV | [`gavang24.m3u`](https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gavang24.m3u) | [`gavang24`](https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gavang24) |
| **🏟️ Khán Đài TV** | 10 | HLS | [`khandai.m3u`](https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/khandai.m3u) | [`khandai`](https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/khandai) |
| **🥣 Xôi Chè TV** | 9 | HLS | [`xoiche.m3u`](https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/xoiche.m3u) | [`xoiche`](https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/xoiche) |

> [!NOTE]
> - Các danh mục **gv**, **gv_sv1** và **gv_sv2** được sắp xếp cố định theo thứ tự bảng xếp hạng BLV, tích hợp sẵn logo đại diện và tự động hiển thị tên trận đấu khi đang phát trực tiếp.
> - Nếu ứng dụng IPTV của bạn không nhận link có đuôi `.m3u`, hãy dùng link **Direct File (Không đuôi)**.

<details>
<summary>📋 <b>Xem toàn bộ danh sách URL dạng Text (dễ sao chép hàng loạt)</b></summary>

```text
https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/sport.m3u
https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/sport
https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gv.m3u
https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gv
https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gv_sv1.m3u
https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gv_sv1
https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gv_sv2.m3u
https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gv_sv2
https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/cola.m3u
https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/cola
https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gavang33.m3u
https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gavang33
https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gavang24.m3u
https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gavang24
https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/khandai.m3u
https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/khandai
https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/xoiche.m3u
https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/xoiche
```
</details>

---

## ⚡ 2. TRIỂN KHAI CLOUDFLARE WORKER (KHUYÊN DÙNG)

Để giải quyết triệt để vấn đề đồng bộ tên trận đấu theo thời gian thực (Real-time), dự án đã tích hợp sẵn mã nguồn **Cloudflare Worker Serverless** trong thư mục [`cloudflare/`](cloudflare/):

* **Real-time 100%**: Khi BLV bắt đầu bình luận trận đấu mới, danh sách phát sẽ tự động cập nhật ngay lập tức.
* **Biến môi trường động**: Dễ dàng thay đổi tên miền referer (`GAVANG_REFERER`) trực tiếp trên dashboard Cloudflare khi nhà đài đổi domain mà không cần sửa code.
* **Edge Caching siêu tốc**: Tốc độ phản hồi cực nhanh (~10-20ms) qua hạ tầng Cloudflare tại Việt Nam, không lo bị chặn IP API.
* **Miễn phí**: Hoạt động hoàn toàn trên gói Free (100.000 requests/ngày).

👉 *Xem hướng dẫn cài đặt chi tiết trong 2 phút tại: [**`cloudflare/README.md`**](cloudflare/README.md)*.

---

## 📺 3. HƯỚNG DẪN CÀI ĐẶT VÀO ỨNG DỤNG

### 1. TiviMate IPTV (Android TV)
1. Mở ứng dụng **TiviMate** ➔ vào **Cài đặt (Settings)** ➔ **Danh sách phát (Playlists)** ➔ **Thêm danh sách phát (Add playlist)**.
2. Chọn **Danh sách M3U (M3U playlist)**.
3. Dán link nguồn mong muốn (Ví dụ: `https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/gv.m3u`).
4. Đặt tên danh sách và bật tùy chọn **Tự động cập nhật danh sách khi khởi động (Auto-update playlist on app start)**.

### 2. OTT Navigator IPTV
1. Vào **Cài đặt (Settings)** ➔ **Nhà cung cấp (Providers)** ➔ **Thêm nhà cung cấp (Add provider)**.
2. Chọn loại danh sách **Playlist M3U**.
3. Dán link nguồn mong muốn và chọn chu kỳ cập nhật hàng ngày (**Update daily**).

### 3. VLC Media Player (Windows / macOS / Mobile)
1. Mở ứng dụng VLC ➔ nhấn phím tắt `Ctrl + N` (hoặc vào menu `Media` ➔ `Open Network Stream`).
2. Dán link nguồn (Ví dụ: `https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main/sport.m3u`).
3. Nhấn **Play** để thưởng thức.

### 4. Chạy Server Mạng Nội Bộ (LAN)
Nếu bạn muốn chia sẻ danh sách phát trong mạng Wi-Fi gia đình mà không cần kết nối ra ngoài:
```powershell
python server.py
```
Màn hình console sẽ hiển thị địa chỉ IP nội bộ (Ví dụ: `http://192.168.1.x:8080`) kèm giao diện Web để copy link trực tiếp vào TV Box.

---

## 🛠️ 4. LƯU Ý VỀ ĐỊNH DẠNG LUỒNG (HLS & FLV)

| Định Dạng | Danh Mục Tiêu Biểu | Đặc Điểm | Cách Khắc Phục Nếu Lỗi |
| :--- | :--- | :--- | :--- |
| **HLS (`.m3u8`)** | `gv_sv1`, Khán Đài, Xôi Chè | Tương thích tốt với hầu hết thiết bị và trình phát mặc định. | Không cần cấu hình thêm. |
| **FLV (`.flv`)** | `gv_sv2`, Gà Vàng 24H, Cola TV SV3 | Độ trễ thấp, mượt mà nhưng một số TV Box cũ có thể bị đen màn hình. | Vào **Cài đặt** ➔ **Phát lại** ➔ chuyển sang **Bộ giải mã phần mềm (Software Decoder)** hoặc chọn trình phát ngoài (VLC/IjkPlayer). |

---

## 📁 5. CẤU TRÚC THƯ MỤC

```text
iptv/
├── .github/workflows/       # Workflow GitHub Actions (Trigger thủ công khi cần)
│   └── update-playlist.yml
├── assets/blv/              # Logo và avatar đại diện của từng BLV
├── cloudflare/              # Mã nguồn & cấu hình Cloudflare Worker (Khuyên dùng)
│   ├── worker.js            # Serverless M3U Generator với Edge Cache & Dashboard
│   ├── wrangler.toml        # Cấu hình biến môi trường động (GAVANG_REFERER, TTL...)
│   └── README.md            # Hướng dẫn chi tiết triển khai Worker
├── scripts/                 # Script Python cập nhật danh sách offline
│   └── update.py
├── sources/                 # Dữ liệu kênh cơ sở và cấu hình BLV
│   ├── base_channels.m3u    # 137 kênh thể thao gốc
│   └── gavang33_fixed.json  # Cấu hình 12 BLV Gà Vàng cố định
├── server.py                # Máy chủ Web nội bộ LAN phục vụ phát sóng gia đình
├── .gitignore               # Cấu hình bỏ qua các file tạm, cache, môi trường ảo
└── README.md                # Tài liệu hướng dẫn sử dụng chính
```

---

## ⚠️ 6. MIỄN TRỪ TRÁCH NHIỆM

Dự án không lưu trữ, tiếp sóng hay phát lại bất kỳ tín hiệu truyền hình nào. Toàn bộ đường dẫn luồng phát trực tiếp được tổng hợp và thu thập tự động từ các nguồn công khai trên Internet nhằm mục đích nghiên cứu học tập kỹ thuật và phục vụ nhu cầu giải trí cá nhân.
