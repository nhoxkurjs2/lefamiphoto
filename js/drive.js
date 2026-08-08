/**
 * Google Drive backend
 * Cấu trúc: ROOT / [Tên gia đình] / ảnh...
 * Metadata ảnh: description = ghi chú, appProperties = family, takenAt, uploadedBy
 */
window.LefamiDrive = (() => {
  const DISCOVERY = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";
  // drive: đọc/ghi thư mục gia đình dùng chung. userinfo: hiện tên người đăng
  const SCOPES =
    "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";

  let tokenClient = null;
  let accessToken = null;
  let user = null;
  let gapiReady = false;

  function cfg() {
    return window.LEFAMI_CONFIG;
  }

  function waitFor(fn, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        if (fn()) return resolve();
        if (Date.now() - start > timeout) return reject(new Error("Google API tải quá lâu"));
        requestAnimationFrame(tick);
      };
      tick();
    });
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

  function setToken(tokenResponse) {
    accessToken = tokenResponse.access_token;
    gapi.client.setToken({ access_token: accessToken });
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
          resolve(user);
        } catch (e) {
          reject(e);
        }
      };
      tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent" });
    });
  }

  async function signOut() {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => {});
      gapi.client.setToken(null);
      accessToken = null;
      user = null;
    }
  }

  function isSignedIn() {
    return Boolean(accessToken && user);
  }

  function getUser() {
    return user;
  }

  async function listFamilies() {
    const root = cfg().ROOT_FOLDER_ID;
    const q = `'${root}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = await gapi.client.drive.files.list({
      q,
      fields: "files(id, name, createdTime)",
      orderBy: "name",
      pageSize: 100,
      spaces: "drive",
    });
    const files = res.result.files || [];
    return [{ id: "all", name: "Tất cả" }, ...files.map((f) => ({ id: f.id, name: f.name }))];
  }

  async function createFamily(name) {
    const clean = String(name || "").trim();
    if (!clean) throw new Error("Tên gia đình không được trống");
    const res = await gapi.client.drive.files.create({
      resource: {
        name: clean,
        mimeType: "application/vnd.google-apps.folder",
        parents: [cfg().ROOT_FOLDER_ID],
      },
      fields: "id, name",
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
      uploadedBy: props.uploadedByName || props.uploadedBy || "",
      createdTime: file.createdTime,
      thumbnailLink: file.thumbnailLink || "",
      webContentLink: file.webContentLink || "",
      mimeType: file.mimeType,
    };
  }

  async function listFolderPhotos(folderId, familyName) {
    const q = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`;
    const res = await gapi.client.drive.files.list({
      q,
      fields:
        "files(id, name, description, createdTime, mimeType, thumbnailLink, webContentLink, appProperties, parents)",
      pageSize: 200,
      orderBy: "createdTime desc",
    });
    return (res.result.files || []).map((f) => parsePhoto(f, familyName));
  }

  async function listPhotos(familyId) {
    if (familyId && familyId !== "all") {
      const families = await listFamilies();
      const fam = families.find((f) => f.id === familyId);
      return listFolderPhotos(familyId, fam?.name);
    }

    const families = await listFamilies();
    const real = families.filter((f) => f.id !== "all");
    const batches = await Promise.all(
      real.map((f) => listFolderPhotos(f.id, f.name))
    );
    return batches.flat();
  }

  async function uploadPhoto({ file, familyId, familyName, note, takenAt }, onProgress) {
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
      delimiter +
      `Content-Type: ${file.type || "image/jpeg"}\r\n\r\n`;

    const metaBytes = new TextEncoder().encode(metaPart + mediaPart);
    const endBytes = new TextEncoder().encode(closeDelim);
    const body = new Uint8Array(metaBytes.length + reader.byteLength + endBytes.length);
    body.set(metaBytes, 0);
    body.set(new Uint8Array(reader), metaBytes.length);
    body.set(endBytes, metaBytes.length + reader.byteLength);

    if (onProgress) onProgress(0.3);

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,description,createdTime,mimeType,thumbnailLink,webContentLink,appProperties,parents",
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
      return photo.thumbnailLink.replace(/=s\d+$/, "=s800");
    }
    return "";
  }

  function getViewUrl(photo) {
    if (photo.thumbnailLink) {
      return photo.thumbnailLink.replace(/=s\d+$/, "=s2000");
    }
    return "";
  }

  /** Tải ảnh full qua API (khi thumbnail hết hạn / không có) */
  async function fetchBlobUrl(fileId) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error("Không tải được ảnh từ Drive");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  return {
    init,
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
    get gapiReady() {
      return gapiReady;
    },
  };
})();
