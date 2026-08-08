/**
 * Chế độ Demo — IndexedDB + vài ảnh mẫu (SVG data URI)
 * Dùng khi chưa cấu hình Google Drive.
 */
window.LefamiDemo = (() => {
  const DB_NAME = "lefami-demo";
  const DB_VER = 1;
  let db = null;
  let user = {
    id: "demo-user",
    name: "Thành viên Demo",
    email: "demo@lefami.local",
    picture: "",
  };

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const store = req.result;
        if (!store.objectStoreNames.contains("families")) {
          store.createObjectStore("families", { keyPath: "id" });
        }
        if (!store.objectStoreNames.contains("photos")) {
          store.createObjectStore("photos", { keyPath: "id" });
        }
        if (!store.objectStoreNames.contains("blobs")) {
          store.createObjectStore("blobs", { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function getOne(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function put(storeName, value) {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    return txDone(tx);
  }

  function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function sampleSvg(label, hue) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(${hue},28%,28%)"/>
          <stop offset="100%" stop-color="hsl(${hue + 30},22%,16%)"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#g)"/>
      <circle cx="920" cy="160" r="70" fill="hsla(40,60%,70%,0.35)"/>
      <text x="80" y="680" fill="#e8dcc8" font-family="Georgia,serif" font-size="52">${label}</text>
      <text x="80" y="730" fill="#d4a574" font-family="sans-serif" font-size="24">Lefami Demo</text>
    </svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  async function seedIfEmpty() {
    const families = await getAll("families");
    if (families.length) return;

    const seeds = [
      { id: "fam_ongba", name: "Nhà Ông Bà" },
      { id: "fam_bacminh", name: "Nhà bác Minh" },
      { id: "fam_cothao", name: "Nhà cô Thảo" },
    ];
    for (const f of seeds) await put("families", f);

    const photos = [
      {
        id: "p1",
        familyId: "fam_ongba",
        familyName: "Nhà Ông Bà",
        note: "Tết sum họp — bàn trà chiều 30",
        takenAt: "2024-02-09T16:20:00.000Z",
        name: "tet-2024.jpg",
        dataUrl: sampleSvg("Tết sum họp", 140),
      },
      {
        id: "p2",
        familyId: "fam_bacminh",
        familyName: "Nhà bác Minh",
        note: "Sinh nhật bé An tròn 5 tuổi",
        takenAt: "2023-08-18T10:00:00.000Z",
        name: "sinhnhat-an.jpg",
        dataUrl: sampleSvg("Sinh nhật bé An", 25),
      },
      {
        id: "p3",
        familyId: "fam_cothao",
        familyName: "Nhà cô Thảo",
        note: "Picnic cuối tuần ở công viên",
        takenAt: "2025-04-12T09:30:00.000Z",
        name: "picnic.jpg",
        dataUrl: sampleSvg("Picnic cuối tuần", 85),
      },
      {
        id: "p4",
        familyId: "fam_ongba",
        familyName: "Nhà Ông Bà",
        note: "Ngày giỗ tổ — cả nhà bên sân",
        takenAt: "2022-11-03T14:00:00.000Z",
        name: "gio-to.jpg",
        dataUrl: sampleSvg("Ngày giỗ tổ", 10),
      },
      {
        id: "p5",
        familyId: "fam_bacminh",
        familyName: "Nhà bác Minh",
        note: "Chuyến về quê mùa lúa chín",
        takenAt: "2021-09-25T07:45:00.000Z",
        name: "lua-chin.jpg",
        dataUrl: sampleSvg("Mùa lúa chín", 55),
      },
    ];

    for (const p of photos) {
      const { dataUrl, ...meta } = p;
      await put("photos", {
        ...meta,
        uploadedBy: "Demo",
        createdTime: meta.takenAt,
      });
      await put("blobs", { id: p.id, dataUrl });
    }
  }

  async function init() {
    db = await openDb();
    await seedIfEmpty();
  }

  async function signIn() {
    return user;
  }

  async function signOut() {
    /* demo stays signed in visually until reload gate */
  }

  function isSignedIn() {
    return true;
  }

  function getUser() {
    return user;
  }

  async function listFamilies() {
    const list = await getAll("families");
    list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    return [{ id: "all", name: "Tất cả" }, ...list];
  }

  async function createFamily(name) {
    const fam = { id: uid("fam"), name: String(name).trim() };
    await put("families", fam);
    return fam;
  }

  async function fetchPhotos(familyId) {
    let photos = await getAll("photos");
    if (familyId && familyId !== "all") {
      photos = photos.filter((p) => p.familyId === familyId);
    }
    return photos;
  }

  async function uploadPhoto({ file, familyId, familyName, note, takenAt }, onProgress) {
    if (!familyId || familyId === "all") {
      throw new Error("Hãy chọn một gia đình cụ thể để tải lên");
    }
    if (onProgress) onProgress(0.2);
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    if (onProgress) onProgress(0.7);
    const id = uid("photo");
    const photo = {
      id,
      name: file.name,
      note: note || "",
      takenAt: takenAt || new Date().toISOString(),
      familyId,
      familyName: familyName || "",
      uploadedBy: user.name,
      createdTime: new Date().toISOString(),
    };
    await put("photos", photo);
    await put("blobs", { id, dataUrl });
    if (onProgress) onProgress(1);
    return photo;
  }

  async function resolveUrl(photo) {
    const blob = await getOne("blobs", photo.id);
    return blob?.dataUrl || "";
  }

  function getThumbnailUrl(photo) {
    return photo._url || "";
  }

  function getViewUrl(photo) {
    return photo._url || "";
  }

  // Enrich photos with blob URLs before UI use
  async function enrich(photos) {
    const out = [];
    for (const p of photos) {
      const url = await resolveUrl(p);
      out.push({ ...p, _url: url, thumbnailLink: url, webContentLink: url });
    }
    return out;
  }

  const api = {
    init,
    signIn,
    signOut,
    isSignedIn,
    getUser,
    listFamilies,
    createFamily,
    async listPhotos(familyId) {
      const photos = await fetchPhotos(familyId);
      return enrich(photos);
    },
    uploadPhoto,
    getThumbnailUrl(photo) {
      return photo._url || photo.thumbnailLink || "";
    },
    getViewUrl(photo) {
      return photo._url || photo.webContentLink || "";
    },
  };

  return api;
})();
