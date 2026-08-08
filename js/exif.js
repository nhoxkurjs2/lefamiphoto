/** Đọc ngày chụp từ EXIF (DateTimeOriginal / CreateDate) */
window.LefamiExif = {
  async readTakenAt(file) {
    if (!window.exifr || !file) return null;
    try {
      const data = await exifr.parse(file, {
        pick: ["DateTimeOriginal", "CreateDate", "ModifyDate", "DateTime"],
      });
      if (!data) return null;
      const raw =
        data.DateTimeOriginal ||
        data.CreateDate ||
        data.ModifyDate ||
        data.DateTime;
      if (!raw) return null;
      const d = raw instanceof Date ? raw : new Date(raw);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString();
    } catch {
      return null;
    }
  },

  formatDisplay(iso) {
    if (!iso) return "Không rõ ngày";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Không rõ ngày";
    return d.toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  },

  formatShort(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  },

  yearOf(iso) {
    if (!iso) return "Khác";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Khác";
    return String(d.getFullYear());
  },

  toDatetimeLocalValue(iso) {
    const d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },
};
