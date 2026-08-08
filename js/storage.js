/** Lớp trừu tượng lưu trữ — Drive hoặc Demo */
window.LefamiStorage = {
  mode: "demo",
  backend: null,

  isConfigured() {
    const c = window.LEFAMI_CONFIG || {};
    if (c.DEMO_MODE) return false;
    const bad = (v) =>
      !v ||
      String(v).includes("YOUR_") ||
      String(v).includes("YOUR_CLIENT");
    return !bad(c.CLIENT_ID) && !bad(c.API_KEY) && !bad(c.ROOT_FOLDER_ID);
  },

  async init() {
    if (this.isConfigured()) {
      this.mode = "drive";
      this.backend = window.LefamiDrive;
      await this.backend.init();
    } else {
      this.mode = "demo";
      this.backend = window.LefamiDemo;
      await this.backend.init();
    }
    return this.mode;
  },

  async tryRestore() {
    if (this.backend.tryRestore) return this.backend.tryRestore();
    return false;
  },

  async signIn() {
    return this.backend.signIn();
  },

  async signOut() {
    return this.backend.signOut();
  },

  getUser() {
    return this.backend.getUser();
  },

  isSignedIn() {
    return this.backend.isSignedIn();
  },

  listFamilies() {
    return this.backend.listFamilies();
  },

  createFamily(name) {
    return this.backend.createFamily(name);
  },

  listPhotos(familyId, familiesCache) {
    return this.backend.listPhotos(familyId, familiesCache);
  },

  uploadPhoto(payload, onProgress) {
    return this.backend.uploadPhoto(payload, onProgress);
  },

  getThumbnailUrl(photo) {
    return this.backend.getThumbnailUrl(photo);
  },

  getViewUrl(photo) {
    return this.backend.getViewUrl(photo);
  },

  async fetchBlobUrl(fileId) {
    if (this.backend.fetchBlobUrl) {
      return this.backend.fetchBlobUrl(fileId);
    }
    return null;
  },
};
