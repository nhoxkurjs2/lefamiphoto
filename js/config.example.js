/**
 * Sao chép file này thành config.js và điền thông tin Google Cloud của bạn.
 * Xem hướng dẫn chi tiết trong README.md
 */
window.LEFAMI_CONFIG = {
  // OAuth 2.0 Client ID từ Google Cloud Console
  CLIENT_ID: "YOUR_CLIENT_ID.apps.googleusercontent.com",

  // API Key từ Google Cloud Console
  API_KEY: "YOUR_API_KEY",

  // ID thư mục gốc trên Google Drive (phần cuối URL khi mở folder)
  // Ví dụ: https://drive.google.com/drive/folders/1ABC...xyz → ROOT_FOLDER_ID = "1ABC...xyz"
  ROOT_FOLDER_ID: "YOUR_ROOT_FOLDER_ID",

  // Tên hiển thị
  SITE_NAME: "Lefami",
  SITE_TAGLINE: "Kỷ niệm đại gia đình",

  // true = dùng bộ nhớ trình duyệt để xem trước UI (không cần Drive)
  DEMO_MODE: false,
};
