/**
 * Google Drive backend
 * Cấu trúc: ROOT / [Tên gia đình] / ảnh...
 */
window.LefamiDrive = (() => {
  const DISCOVERY = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";
  const SCOPES =
    "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";
  const TOKEN_KEY = "lefami_drive_session";

  let tokenClient = null;
  let accessToken = null;
  let tokenExpiresAt = 0;
  let user = null;
  let gapiReady = false;

  function cfg() {
    return window.LEFAMI_CONFIG;
  }

  function waitFor(fn, timeout = 20000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        if (fn()) return resolve();
        if (Date.now() - start > timeout) return reject(new Error("Google API tải quá lâu"));
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  function saveSession() {
    if (!accessToken || !user) return;
    try {
      localStorage.setItem(
        TOKEN_KEY,
        JSON.stringify({
          accessToken,
          expiresAt: tokenExpiresAt,
          user,
        })
      );
    } catch (_) {}
  }

  function clearSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (_) {}
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function setToken(tokenResponse) {
    accessToken = tokenResponse.access_token;
    const expiresIn = Number(tokenResponse.expires_in || 3600);
    tokenExpiresAt = Date.now() + Math.max(60, expiresIn - 60) * 1000;
    gapi.client.setToken({ access_token: accessToken });
  }

  /** Tham số cần có để thấy file trong thư mục được share */
  function driveListParams(extra) {
    return Object.assign(
      {
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        spaces: "drive",
        pageSize: 200,
      },
      extra || {}
    );
  }

  async function listAllPages(params) {
    const files = [];
    let pageToken = null;
    do {
      const res = await gapi.client.drive.files.list(
        driveListParams(Object.assign({}, params, pageToken ? { pageToken } : {}))
      );
      files.push.apply(files, res.result.files || []);
      pageToken = res.result.nextPageToken || null;
    } while (pageToken);
    return files;
  }

  async function fetchUser() {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error("Không lấy được thông tin người dùng");
    const data = await res.json();
    user = {
      id: data.sub,
      name: data.name || data.email,
      email: data.email,
      picture: data.picture || "",
    };
    return user;
  }

  async function init() {
    await waitFor(() => window.gapi && window.google?.accounts?.oauth2);
    await new Promise((resolve) => gapi.load("client", resolve));
    await gapi.client.init({
      apiKey: cfg().API_KEY,
      discoveryDocs: [DISCOVERY],
    });
    gapiReady = true;

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: cfg().CLIENT_ID,
      scope: SCOPES,
      callback: () => {},
    });
  }

  async function tryRestore() {
    const saved = loadSession();
    if (!saved?.accessToken || !saved?.user) return false;

    if (saved.expiresAt && Date.now() < saved.expiresAt) {
      accessToken = saved.accessToken;
      tokenExpiresAt = saved.expiresAt;
      user = saved.user;
      gapi.client.setToken({ access_token: accessToken });
      // Kiểm tra token còn dùng được không
      try {
        await gapi.client.drive.files.get({
          fileId: cfg().ROOT_FOLDER_ID,
          fields: "id",
          supportsAllDrives: true,
        });
        return true;
      } catch (_) {
        // Token chết → xin lại
      }
    }

    try {
      user = saved.user;
      await silentRefresh();
      return Boolean(accessToken && user);
    } catch (_) {
      clearSession();
      accessToken = null;
      user = null;
      tokenExpiresAt = 0;
      return false;
    }
  }

  function silentRefresh() {
    return new Promise((resolve, reject) => {
      if (!tokenClient) {
        reject(new Error("Google chưa sẵn sàng"));
        return;
      }
      tokenClient.callback = async (resp) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        try {
          setToken(resp);
          if (!user) await fetchUser();
          saveSession();
          resolve(user);
        } catch (e) {
          reject(e);
        }
      };
      tokenClient.requestAccessToken({ prompt: "" });
    });
  }

  function signIn() {
    return new Promise((resolve, reject) => {
      if (!tokenClient) {
        reject(new Error("Google chưa sẵn sàng. Kiểm tra config.js"));
        return;
      }
      tokenClient.callback = async (resp) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        try {
          setToken(resp);
          await fetchUser();
          saveSession();
          resolve(user);
        } catch (e) {
          reject(e);
        }
      };
      // select_account: cho chọn lại tài khoản sau khi đăng xuất, vẫn giữ quyền đã cấp
      tokenClient.requestAccessToken({ prompt: "select_account" });
    });
  }

  async function signOut() {
    // Không revoke trên Google (revoke dễ làm lần đăng nhập sau mất quyền / list rỗng).
    // Chỉ xóa phiên trên trình duyệt.
    gapi.client.setToken(null);
    accessToken = null;
    user = null;
    tokenExpiresAt = 0;
    clearSession();
  }

  function isSignedIn() {
    return Boolean(accessToken && user);
  }

  function getUser() {
    return user;
  }

  async function ensureToken() {
    if (accessToken && Date.now() < tokenExpiresAt) {
      gapi.client.setToken({ access_token: accessToken });
      return;
    }
    if (!tokenClient) throw new Error("Google chưa sẵn sàng");
    await silentRefresh();
  }

  async function listFamilies() {
    await ensureToken();
    const root = cfg().ROOT_FOLDER_ID;
    if (!root || String(root).includes("YOUR_")) {
      throw new Error("Chưa cấu hình ROOT_FOLDER_ID trong config.js");
    }

    const q =
      "'" +
      root +
      "' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false";

    let files = [];
    try {
      files = await listAllPages({
        q,
        fields: "nextPageToken, files(id, name, createdTime)",
        orderBy: "name",
      });
    } catch (err) {
      // Một số thư mục share không hỗ trợ orderBy
      console.warn("listFamilies orderBy failed, retry", err);
      files = await listAllPages({
        q,
        fields: "nextPageToken, files(id, name, createdTime)",
      });
    }

    return [{ id: "all", name: "Tất cả" }, ...files.map((f) => ({ id: f.id, name: f.name }))];
  }

  async function createFamily(name) {
    await ensureToken();
    const clean = String(name || "").trim();
    if (!clean) throw new Error("Tên gia đình không được trống");
    const res = await gapi.client.drive.files.create({
      resource: {
        name: clean,
        mimeType: "application/vnd.google-apps.folder",
        parents: [cfg().ROOT_FOLDER_ID],
      },
      fields: "id, name",
      supportsAllDrives: true,
    });
    return { id: res.result.id, name: res.result.name };
  }

  function parsePhoto(file, familyName) {
    const props = file.appProperties || {};
    return {
      id: file.id,
      name: file.name,
      note: file.description || props.note || "",
      takenAt: props.takenAt || file.createdTime,
      familyId: props.familyId || (file.parents && file.parents[0]) || "",
      familyName: props.familyName || familyName || "",
      uploadedById: props.uploadedBy || "",
      uploadedBy: props.uploadedByName || "",
      createdTime: file.createdTime,
      thumbnailLink: file.thumbnailLink || "",
      webContentLink: file.webContentLink || "",
      mimeType: file.mimeType,
    };
  }

  async function listFolderPhotos(folderId, familyName) {
    const q =
      "'" + folderId + "' in parents and mimeType contains 'image/' and trashed = false";
    let files = [];
    try {
      files = await listAllPages({
        q,
        fields:
          "nextPageToken, files(id, name, description, createdTime, mimeType, thumbnailLink, appProperties, parents)",
        orderBy: "createdTime desc",
      });
    } catch (err) {
      console.warn("listFolderPhotos orderBy failed, retry", err);
      files = await listAllPages({
        q,
        fields:
          "nextPageToken, files(id, name, description, createdTime, mimeType, thumbnailLink, appProperties, parents)",
      });
    }
    return files.map((f) => parsePhoto(f, familyName));
  }

  async function listPhotos(familyId, familiesCache) {
    await ensureToken();

    if (familyId && familyId !== "all") {
      const fam = (familiesCache || []).find((f) => f.id === familyId);
      return listFolderPhotos(familyId, fam?.name);
    }

    // Luôn lấy lại danh sách thư mục mới (tránh cache cũ sau đăng nhập lại)
    const families = await listFamilies();
    const real = families.filter((f) => f.id !== "all");
    const out = [];

    for (let i = 0; i < real.length; i += 3) {
      const chunk = real.slice(i, i + 3);
      const batch = await Promise.all(chunk.map((f) => listFolderPhotos(f.id, f.name)));
      out.push(...batch.flat());
    }

    // Ảnh nằm thẳng trong thư mục gốc (nếu có)
    try {
      const rootPhotos = await listFolderPhotos(cfg().ROOT_FOLDER_ID, "Gốc");
      out.push(...rootPhotos);
    } catch (err) {
      console.warn("list root photos", err);
    }

    // Gỡ trùng id
    const seen = new Set();
    return out.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  async function uploadPhoto({ file, familyId, familyName, note, takenAt }, onProgress) {
    await ensureToken();
    if (!familyId || familyId === "all") {
      throw new Error("Hãy chọn một gia đình cụ thể để tải lên");
    }

    const metadata = {
      name: file.name,
      description: note || "",
      parents: [familyId],
      appProperties: {
        familyId: String(familyId),
        familyName: String(familyName || ""),
        takenAt: String(takenAt || new Date().toISOString()),
        uploadedBy: String(user?.id || ""),
        uploadedByName: String(user?.name || ""),
      },
    };

    const boundary = "lefami_boundary_" + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    const reader = await file.arrayBuffer();
    const metaPart =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata);
    const mediaPart =
      delimiter + `Content-Type: ${file.type || "image/jpeg"}\r\n\r\n`;

    const metaBytes = new TextEncoder().encode(metaPart + mediaPart);
    const endBytes = new TextEncoder().encode(closeDelim);
    const body = new Uint8Array(metaBytes.length + reader.byteLength + endBytes.length);
    body.set(metaBytes, 0);
    body.set(new Uint8Array(reader), metaBytes.length);
    body.set(endBytes, metaBytes.length + reader.byteLength);

    if (onProgress) onProgress(0.3);

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,description,createdTime,mimeType,thumbnailLink,appProperties,parents",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error("Upload thất bại: " + err.slice(0, 200));
    }

    if (onProgress) onProgress(1);
    const data = await res.json();
    return parsePhoto(data, familyName);
  }

  function getThumbnailUrl(photo) {
    if (photo.thumbnailLink) {
      return photo.thumbnailLink.replace(/=s\d+$/, "=s360");
    }
    return "";
  }

  function getViewUrl(photo) {
    if (photo.thumbnailLink) {
      return photo.thumbnailLink.replace(/=s\d+$/, "=s1280");
    }
    return "";
  }

  async function fetchBlobUrl(fileId) {
    await ensureToken();
    const res = await fetch(
      "https://www.googleapis.com/drive/v3/files/" +
        encodeURIComponent(fileId) +
        "?alt=media&supportsAllDrives=true",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error("Không tải được ảnh từ Drive");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  return {
    init,
    tryRestore,
    signIn,
    signOut,
    isSignedIn,
    getUser,
    listFamilies,
    createFamily,
    listPhotos,
    uploadPhoto,
    getThumbnailUrl,
    getViewUrl,
    fetchBlobUrl,
    async deletePhoto(fileId) {
      await ensureToken();
      if (!fileId) throw new Error("Thiếu id ảnh");
      await gapi.client.drive.files.delete({
        fileId,
        supportsAllDrives: true,
      });
      return true;
    },
    get gapiReady() {
      return gapiReady;
    },
  };
})();
