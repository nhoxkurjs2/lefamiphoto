# Hướng dẫn chi tiết: Kết nối Google Drive cho Lefami

Làm lần lượt **5 phần** dưới đây. Khoảng 15–25 phút. Chuẩn bị: tài khoản Google (Gmail) của bạn.

Bạn sẽ lấy được **3 giá trị** để dán vào `js/config.js`:

| Giá trị | Ví dụ |
|---|---|
| `ROOT_FOLDER_ID` | `1AbCdEfGhIjKlMnOpQrStUv` |
| `API_KEY` | `AIzaSyBxxxxxxxx` |
| `CLIENT_ID` | `123456-abc.apps.googleusercontent.com` |

---

## PHẦN 1 — Tạo thư mục lưu ảnh trên Google Drive

1. Mở trình duyệt → vào: https://drive.google.com  
2. Đăng nhập đúng Gmail bạn sẽ dùng làm “chủ kho ảnh”.  
3. Bên trái, bấm **+ Mới** (hoặc **New**).  
4. Chọn **Thư mục** / **Folder**.  
5. Đặt tên: `Lefami` → bấm **Tạo** / **Create**.  
6. **Nhấp đôi** vào thư mục `Lefami` vừa tạo để mở nó.  
7. Nhìn thanh địa chỉ trình duyệt, URL dạng:

   ```
   https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
   ```

8. Copy phần **sau** `/folders/` — đó là `ROOT_FOLDER_ID`.  
   Ví dụ: `1AbCdEfGhIjKlMnOpQrStUvWxYz`  
   → Dán vào Notepad để giữ tạm.

9. Chia sẻ thư mục cho gia đình:
   - Trong thư mục `Lefami`, bấm nút **Chia sẻ** / **Share** (góc trên bên phải).  
   - Ô **Thêm người và nhóm** / **Add people**: gõ Gmail từng người trong nhà.  
   - Quyền chọn **Biên tập viên** / **Editor** (để họ tải ảnh lên được).  
   - Bỏ tick “Thông báo” nếu không muốn gửi email (tuỳ bạn).  
   - Bấm **Chia sẻ** / **Send**.

> Tip: Có thể thêm dần từng người sau; người chưa được share sẽ không thấy/upload được ảnh trong thư mục này.

---

## PHẦN 2 — Tạo project trên Google Cloud

1. Mở: https://console.cloud.google.com/  
2. Đăng nhập **cùng Gmail** vừa tạo thư mục Drive.  
3. Nếu Google hỏi chấp nhận điều khoản → bấm đồng ý / Agree.  
4. Trên thanh trên cùng, bấm ô chọn project (chữ kiểu **Select a project** hoặc tên project hiện tại).  
5. Trong popup, bấm **New project** / **Dự án mới**.  
6. **Project name**: gõ `Lefami Photo`  
7. **Organization / Location**: để mặc định.  
8. Bấm **Create** / **Tạo**.  
9. Đợi vài giây → bấm lại ô chọn project → chọn **Lefami Photo** (quan trọng: phải đang đứng đúng project này).

> Không cần gắn thẻ thanh toán (Billing) cho việc dùng cơ bản này.

---

## PHẦN 3 — Bật Google Drive API

1. Trong ô tìm kiếm trên cùng của Cloud Console (Search), gõ: `Google Drive API`  
2. Bấm kết quả **Google Drive API** (loại *API Library*).  
3. Trang chi tiết API mở ra → bấm nút xanh **Enable** / **Bật**.  
4. Đợi tới khi thấy trạng thái đã bật (có thể hiện nút Manage).

---

## PHẦN 4 — Cấu hình đăng nhập Google (OAuth) + tạo Client ID & API Key

Giao diện mới của Google nằm trong mục **Google Auth Platform**.  
Nếu menu trái chưa thấy, dùng ô Search trên cùng.

### 4.1. Cấu hình màn hình đồng ý (Consent / Branding)

1. Search: `Google Auth Platform` → vào **Google Auth Platform**.  
   (Hoặc mở trực tiếp: https://console.cloud.google.com/auth/overview )  
2. Nếu thấy **Get started** / **Bắt đầu** → bấm vào.  
3. Điền:
   - **App name**: `Lefami`  
   - **User support email**: chọn Gmail của bạn  
4. **Audience** / Đối tượng:
   - Chọn **External** (bắt buộc nếu gia đình dùng Gmail thường, không phải Google Workspace công ty).  
5. **Contact email**: thêm Gmail của bạn.  
6. Đồng ý User Data Policy → **Continue** / **Create**.  

### 4.2. Thêm người được phép đăng nhập (Test users)

App mới mặc định ở chế độ **Testing** — chỉ email bạn thêm vào mới đăng nhập được.

1. Trong Google Auth Platform, vào tab **Audience**.  
2. Mục **Test users** → bấm **Add users** / **Thêm người dùng**.  
3. Dán từng Gmail của cả nhà (mỗi dòng một email, hoặc thêm từng cái).  
   - Nhớ thêm **chính Gmail của bạn**.  
4. Bấm **Save**.

> Sau này muốn cả thế giới đăng nhập được thì phải **Publish app** (có thể Google yêu cầu xác minh vì dùng quyền Drive). Với gia đình, giữ **Testing + Test users** là đủ và an toàn hơn.

### 4.3. Thêm quyền (Scopes) — để app đọc/ghi Drive

1. Vào **Data Access** (trong Google Auth Platform).  
2. Bấm **Add or remove scopes**.  
3. Trong danh sách / ô lọc, tìm và **tick** các scope:
   - `.../auth/drive` — xem và quản lý file Drive  
   - `.../auth/userinfo.email`  
   - `.../auth/userinfo.profile`  
4. Bấm **Update** → **Save**.

> Khi thành viên đăng nhập lần đầu, Google sẽ hiện cảnh báo “Google hasn’t verified this app”.  
> Họ bấm **Advanced** / **Nâng cao** → **Go to Lefami (unsafe)** / **Tiếp tục** — bình thường với app gia đình đang Testing.

### 4.4. Tạo OAuth Client ID (Web)

1. Vào **Clients** (Google Auth Platform) → bấm **Create client** / **Create Client**.  
2. **Application type**: chọn **Web application**.  
3. **Name**: `Lefami Web`.  
4. Mục **Authorized JavaScript origins** → bấm **Add URI**, thêm lần lượt (mỗi dòng một URI, **không** có dấu `/` ở cuối):

   ```
   https://nhoxkurjs2.github.io
   http://localhost
   http://localhost:8080
   http://127.0.0.1
   http://127.0.0.1:8080
   ```

5. **Authorized redirect URIs**: có thể để trống (Lefami dùng đăng nhập popup/token, không bắt buộc redirect).  
6. Bấm **Create**.  
7. Popup hiện **Client ID** → **Copy** ngay.  
   Dạng: `123456789-xxxxxx.apps.googleusercontent.com`  
   → Dán vào Notepad (`CLIENT_ID`).  
8. **Client secret** không cần dùng cho Lefami (bỏ qua / đóng).

### 4.5. Tạo API Key

1. Mở: https://console.cloud.google.com/apis/credentials  
   (Hoặc menu **APIs & Services** → **Credentials**).  
2. Trên cùng bấm **+ Create credentials** → chọn **API key**.  
3. Copy **API key** hiện ra → dán Notepad (`API_KEY`).  
4. (Khuyến nghị) Bấm **Edit API key** / biểu tượng bút:
   - **API restrictions** → **Restrict key** → chỉ chọn **Google Drive API** → **Save**.  
   - Có thể hạn chế HTTP referrer thêm `https://nhoxkurjs2.github.io/*` nếu muốn.

---

## PHẦN 5 — Dán vào code và đưa lên GitHub Pages

### 5.1. Sửa file cấu hình

1. Mở thư mục project: `C:\Users\JENNY\Desktop\lefamiphoto`  
2. Mở file: `js\config.js` bằng Cursor / Notepad.  
3. Thay 3 chỗ `YOUR_...` bằng giá trị thật, ví dụ:

```js
window.LEFAMI_CONFIG = {
  CLIENT_ID: "123456789-abcdefg.apps.googleusercontent.com",
  API_KEY: "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  ROOT_FOLDER_ID: "1AbCdEfGhIjKlMnOpQrStUvWxYz",
  SITE_NAME: "Lefami",
  SITE_TAGLINE: "Kỷ niệm đại gia đình",
  DEMO_MODE: false,
};
```

4. **Lưu file** (Ctrl+S).

> Nếu còn chữ `YOUR_` trong 3 ô đó, trang sẽ vẫn chạy Demo, chưa nối Drive.

### 5.2. Đẩy lên GitHub

Trên máy bạn (GitHub Desktop hoặc Terminal):

**Cách A — GitHub Desktop (dễ nhất)**  
1. Mở GitHub Desktop → chọn repo `lefamiphoto`.  
2. Nếu repo chưa trỏ đúng folder Desktop\lefamiphoto, dùng **Add existing repository**.  
3. Phần Changes sẽ thấy các file mới.  
4. Summary: `Connect Lefami to Google Drive`  
5. Bấm **Commit to main** → **Push origin**.

**Cách B — dòng lệnh** (nếu đã cài Git và PATH nhận lệnh `git`):

```bash
cd C:\Users\JENNY\Desktop\lefamiphoto
git add .
git commit -m "Connect Lefami to Google Drive"
git push origin main
```

### 5.3. Kiểm tra GitHub Pages

1. Vào repo: https://github.com/nhoxkurjs2/lefamiphoto  
2. **Settings** → bên trái **Pages**.  
3. **Source**: Deploy from a branch.  
4. Branch: `main` / folder `/ (root)` → **Save**.  
5. Đợi 1–3 phút, mở: https://nhoxkurjs2.github.io/lefamiphoto/  

### 5.4. Thử đăng nhập thật

1. Mở trang Lefami.  
2. Banner Demo **không còn** (nếu config đúng).  
3. Bấm **Đăng nhập với Google** → chọn Gmail đã thêm Test user.  
4. Nếu thấy cảnh báo chưa verified → **Advanced** → **Go to Lefami**.  
5. Cho phép quyền Drive.  
6. Bấm **+ Tạo gia đình** → ví dụ `Nhà Ông Bà`.  
7. Bấm **Thêm ảnh** → chọn vài ảnh → **Tải lên**.  
8. Vào lại Google Drive → mở thư mục `Lefami` → sẽ thấy thư mục con + ảnh vừa upload.

---

## Checklist nhanh nếu bị lỗi

| Hiện tượng | Cách xử lý |
|---|---|
| Vẫn hiện banner Demo | `config.js` còn `YOUR_...` hoặc chưa push lên GitHub |
| `redirect_uri_mismatch` / origin invalid | Thiếu `https://nhoxkurjs2.github.io` trong **Authorized JavaScript origins** (không thêm `/lefamiphoto`) |
| Access blocked / app not verified | Thêm email vào **Test users**; bấm Advanced → Continue |
| Đăng nhập được nhưng không thấy/upload | Share thư mục Drive với quyền **Editor**; kiểm tra `ROOT_FOLDER_ID` đúng |
| `API key not valid` | Sai API key, hoặc key bị restrict sai API / sai referrer |
| Ảnh không hiện sau upload | Đợi vài giây → F5; thumbnail Drive đôi khi chậm |

---

## Thứ tự nhớ 30 giây

1. Drive tạo folder `Lefami` → copy ID → share Editor cho nhà  
2. Cloud tạo project → Enable **Drive API**  
3. Auth Platform: External + Test users + scopes Drive  
4. Tạo **Web Client ID** (origins) + **API Key**  
5. Dán vào `js/config.js` → push GitHub → đăng nhập thử  

Xong 5 bước là cả nhà dùng chung một kho ảnh trên Drive qua trang Lefami.
