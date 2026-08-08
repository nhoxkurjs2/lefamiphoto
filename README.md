# Lefami — Kỷ niệm đại gia đình

Trang web chia sẻ & lưu trữ ảnh gia đình, host trên **GitHub Pages**, ảnh lưu trên **Google Drive**.

Site: https://nhoxkurjs2.github.io/lefamiphoto/

## Tính năng

- **Timeline đẹp**: dòng thời gian theo năm, ảnh xen kẽ, animation khi cuộn
- **Hero tự đổi ảnh**: slideshow toàn màn hình với hiệu ứng ken-burns
- **Phát kỷ niệm**: chế độ xem toàn màn hình lần lượt từng ảnh
- **Thư mục theo gia đình**: tạo nhánh (Nhà Ông Bà, Nhà bác Minh…) trên Drive
- **Upload hàng loạt**: kéo-thả, ghi chú, chọn thời gian
- **Tự đọc EXIF**: lấy ngày chụp từ file ảnh và sắp xếp timeline
- **Google Drive**: mọi người đăng nhập Google → upload vào cùng thư mục gốc

## Cấu trúc thư mục Drive

```
📁 Lefami (thư mục gốc — ROOT_FOLDER_ID)
 ├─ 📁 Nhà Ông Bà
 │   ├─ 🖼 anh1.jpg
 │   └─ 🖼 anh2.jpg
 ├─ 📁 Nhà bác Minh
 └─ 📁 Nhà cô Thảo
```

Mỗi ảnh lưu kèm: ghi chú (description) + ngày chụp + tên người đăng (appProperties).

---

## Bước 1 — Tạo thư mục trên Google Drive

1. Vào [Google Drive](https://drive.google.com)
2. Tạo thư mục mới, đặt tên ví dụ `Lefami`
3. Mở thư mục → copy **ID** trên URL:

   `https://drive.google.com/drive/folders/1AbCDefGHijKLmnOPQrsTUVwxYZ`  
   → ID = `1AbCDefGHijKLmnOPQrsTUVwxYZ`

4. **Chia sẻ** thư mục này với cả gia đình (quyền **Editor**) để mọi người xem/tải lên được

---

## Bước 2 — Tạo dự án Google Cloud (OAuth)

1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới, ví dụ `Lefami Photo`
3. **APIs & Services → Library** → bật **Google Drive API**
4. **APIs & Services → OAuth consent screen**
   - User type: **External** (hoặc Internal nếu dùng Google Workspace)
   - App name: `Lefami`
   - Thêm scope: `.../auth/drive`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`
   - **Test users**: thêm email Google của các thành viên gia đình (khi app còn ở chế độ Testing)
5. **Credentials → Create credentials**
   - **API key** → copy lại
   - **OAuth client ID** → Application type: **Web application**
     - Authorized JavaScript origins:
       - `https://nhoxkurjs2.github.io`
       - `http://localhost` (nếu xem local)
       - `http://127.0.0.1`
     - Authorized redirect URIs (có thể để trống với GIS token client)
6. Copy **Client ID**

---

## Bước 3 — Điền cấu hình

Mở `js/config.js` và thay:

```js
window.LEFAMI_CONFIG = {
  CLIENT_ID: "xxxxx.apps.googleusercontent.com",
  API_KEY: "AIzaxxxxx",
  ROOT_FOLDER_ID: "1AbCDefGHijKLmnOPQrsTUVwxYZ",
  SITE_NAME: "Lefami",
  SITE_TAGLINE: "Kỷ niệm đại gia đình",
  DEMO_MODE: false,
};
```

> Khi chưa điền đúng 3 giá trị trên, trang **tự chạy chế độ Demo** (ảnh mẫu trong trình duyệt) để bạn xem giao diện trước.

---

## Bước 4 — Đẩy lên GitHub Pages

```bash
git add .
git commit -m "Add Lefami family photo archive"
git push origin main
```

Đảm bảo repo Settings → Pages → Source = nhánh `main` / thư mục `/ (root)`.

Sau vài phút mở: https://nhoxkurjs2.github.io/lefamiphoto/

---

## Cách dùng trong gia đình

1. Gửi link trang web cho mọi người
2. Mỗi người **Đăng nhập Google** (email đã được thêm Test user / hoặc app đã Publish)
3. Tạo các **gia đình / nhánh** (thư mục trên Drive)
4. **Thêm ảnh** — chọn 1 hoặc nhiều ảnh, ghi chú, thời gian (tự lấy từ EXIF nếu có)
5. Xem **Dòng thời gian**, bấm **Phát** để xem slideshow kỷ niệm

---

## Chạy local

Mở bằng static server (tránh `file://` vì Google OAuth cần origin hợp lệ):

```bash
# Python
python -m http.server 8080

# hoặc VS Code Live Server
```

Rồi mở `http://localhost:8080`

---

## Lưu ý bảo mật

- `API_KEY` và `CLIENT_ID` nằm phía client là bình thường với OAuth web app
- Hạn chế bằng **OAuth consent + Test users** và **chia sẻ Drive folder** chỉ trong gia đình
- Không commit file chứa Service Account private key
- Khi đủ người dùng, có thể **Publish** app trên OAuth consent screen (Google có thể yêu cầu verify nếu scope nhạy cảm)

## Cấu trúc code

```
index.html          # Trang chính
css/main.css        # Giao diện
js/config.js        # Cấu hình của bạn
js/config.example.js
js/app.js           # Điều phối UI
js/drive.js         # Google Drive API
js/demo.js          # Chế độ demo / IndexedDB
js/storage.js       # Abstraction Drive | Demo
js/exif.js          # Đọc ngày từ EXIF
js/timeline.js      # Timeline, hero, theater, lightbox
js/upload.js        # Upload hàng loạt
```
