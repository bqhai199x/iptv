# ⚡ HƯỚNG DẪN TRIỂN KHAI CLOUDFLARE WORKER CHO IPTV BLV

Giải pháp chạy **Serverless Edge M3U Generator** trên Cloudflare Worker hoàn toàn miễn phí (100.000 requests/ngày), tự động đồng bộ tên trận đấu trực tiếp của BLV theo thời gian thực (Real-time), không cần chạy GitHub Actions, không làm rác commit Git và không lo bị khóa IP.

---

## 📌 1. Các Biến Môi Trường Động (Environment Variables)

Toàn bộ các thông số nhạy cảm và tên miền dễ thay đổi đều được đưa thành **Biến môi trường (Env Vars)**:

| Tên Biến | Giá Trị Mặc Định | Ý Nghĩa / Mục Đích |
| :--- | :--- | :--- |
| **`GAVANG_REFERER`** | `https://gavang33.ac` | **Tên miền Referer của Gà Vàng.** Khi Gà Vàng đổi sang domain mới (ví dụ: `https://gavang35.ac`), bạn chỉ cần cập nhật biến này trong Settings của Worker mà **không cần sửa lại code**. |
| **`GAVANG_API_URL`** | `https://gavangtv-api.adviceme.io/api/v1/matches?webType=gavang` | Endpoint API trả về danh sách lịch thi đấu & BLV. |
| **`GITHUB_RAW_BASE`** | `https://raw.githubusercontent.com/bqhai199x/iptv/refs/heads/main` | Kho lưu trữ chứa danh sách gốc (`base_channels.m3u`, `gavang33_fixed.json`) và logo đại diện BLV. |
| **`CACHE_TTL`** | `180` | Thời gian lưu cache tại Cloudflare Edge (giây). 180s = 3 phút. Giúp app xem cực mượt, tải ngay tức thì và bảo vệ API không bị chặn IP. |
| **`DEFAULT_EPG`** | `https://lichphatsong.io.vn/epg.xml` | Link lịch phát sóng EPG cho IPTV. |

---

## 🚀 2. Cách Triển Khai (Chọn 1 trong 2 cách)

### Cách 1: Thao tác trực tiếp trên giao diện Web Cloudflare (Khuyên dùng - Nhanh nhất, 2 phút)

1. **Tạo Worker mới**:
   * Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com/).
   * Menu bên trái chọn **Workers & Pages** ➔ **Create application** ➔ chọn tab **Workers** ➔ nhấn **Create Worker**.
   * Đặt tên cho Worker (ví dụ: `iptv-blv`) rồi bấm **Deploy**.
2. **Dán mã nguồn**:
   * Sau khi Deploy xong, bấm vào nút **Edit code** ở góc trên bên phải.
   * Xóa toàn bộ nội dung mẫu có sẵn, mở file [`cloudflare/worker.js`](./worker.js), copy toàn bộ nội dung và dán vào.
   * Nhấn **Deploy** (hoặc Save and Deploy).
3. **Cấu hình Biến môi trường động**:
   * Quay lại trang quản lý Worker, chọn tab **Settings** ➔ chọn mục **Variables and Secrets** (hoặc **Variables**).
   * Bấm **Add** và thêm biến:
     * Variable name: `GAVANG_REFERER`
     * Value: `https://gavang33.ac`
   * *(Tùy chọn)* Thêm biến `CACHE_TTL` = `180`.
   * Bấm **Save and Deploy**.

---

### Cách 2: Triển khai bằng Wrangler CLI (Dành cho Developer)

Nếu bạn đã có tài khoản Cloudflare và muốn deploy trực tiếp từ máy tính:

1. Mở PowerShell trong thư mục dự án và đăng nhập Cloudflare:
   ```powershell
   cmd /c "npx wrangler login"
   ```
2. Deploy Worker:
   ```powershell
   cd cloudflare
   cmd /c "npx wrangler deploy"
   ```
   *(Wrangler sẽ tự động đọc cấu hình và biến môi trường trong file `wrangler.toml`)*.

---

## 📺 3. Các Đường Dẫn URL Sau Khi Triển Khai

Sau khi deploy, bạn sẽ nhận được một đường dẫn có dạng:
`https://<ten-worker>.<subdomain>.workers.dev` (ví dụ: `https://iptv-blv.yourname.workers.dev`).

Worker hỗ trợ đầy đủ các đường dẫn sau:

| Tên Danh Mục | Định dạng `.m3u` | Direct File (TiviMate / OTT) |
| :--- | :--- | :--- |
| **🌐 Web Dashboard** | `https://<worker-domain>/` *(Mở trên trình duyệt để copy link 1 chạm)* | — |
| **⚽ Tổng Hợp BLV (137 Kênh)** | `https://<worker-domain>/sport.m3u` | `https://<worker-domain>/sport` |
| **🐔 Gà Vàng 33 (Gộp SV1 + SV2)** | `https://<worker-domain>/gv.m3u` | `https://<worker-domain>/gv` |
| **🐔 Gà Vàng 33 (Server 1 HLS)** | `https://<worker-domain>/gv_sv1.m3u` | `https://<worker-domain>/gv_sv1` |
| **🐔 Gà Vàng 33 (Server 2 FLV)** | `https://<worker-domain>/gv_sv2.m3u` | `https://<worker-domain>/gv_sv2` |
| **🥤 Cola TV** | `https://<worker-domain>/cola.m3u` | `https://<worker-domain>/cola` |
| **🐔 Gà Vàng 33 (Gốc)** | `https://<worker-domain>/gavang33.m3u` | `https://<worker-domain>/gavang33` |
| **🐔 Gà Vàng 24H** | `https://<worker-domain>/gavang24.m3u` | `https://<worker-domain>/gavang24` |
| **🏟️ Khán Đài TV** | `https://<worker-domain>/khandai.m3u` | `https://<worker-domain>/khandai` |
| **🥣 Xôi Chè TV** | `https://<worker-domain>/xoiche.m3u` | `https://<worker-domain>/xoiche` |

---

## 💡 Ưu Điểm So Với Cơ Chế Cũ

1. **Thời gian thực (Real-time)**: BLV vừa bắt đầu bình luận trận đấu mới, chỉ tối đa 3 phút sau là toàn bộ TV Box / TiviMate sẽ hiển thị tên trận đấu (`Arsenal vs Chelsea`).
2. **Không tốn tài nguyên GitHub**: Không chạy GitHub Actions định kỳ, không tạo commit rác vào repo.
3. **Linh hoạt tuyệt đối**: Khi Gà Vàng đổi tên miền website, bạn chỉ cần 5 giây vào Cloudflare Dashboard sửa lại giá trị `GAVANG_REFERER`.
