/** Lefami — bootstrap & orchestration */
(() => {
  const state = {
    families: [],
    activeFamilyId: "all",
    ready: false,
  };

  const $ = (id) => document.getElementById(id);

  function show(el, on = true) {
    if (!el) return;
    el.classList.toggle("hidden", !on);
  }

  function setHeaderSolid() {
    const header = document.querySelector(".site-header");
    if (!header) return;
    const manageOn = document.body.classList.contains("page-manage-on");
    header.classList.toggle("is-solid", manageOn || window.scrollY > 40);
  }

  function updateSubtitle() {
    const fam = state.families.find((f) => f.id === state.activeFamilyId);
    const el = $("gallery-subtitle");
    if (!el) return;
    if (state.activeFamilyId === "all") {
      el.textContent = "Tất cả ảnh của đại gia đình.";
    } else {
      el.textContent = `Album của ${fam?.name || "gia đình"} — xem dạng lưới hoặc dòng thời gian.`;
    }
  }

  function goHome() {
    LefamiTimeline.setPageMode("home");
    setHeaderSolid();
  }

  function goManage() {
    if (LefamiStorage.mode === "drive" && !LefamiStorage.isSignedIn()) {
      show($("auth-gate"), true);
      return;
    }
    LefamiTimeline.setPageMode("manage");
    // Trang quản lý cần đủ ảnh của user → tải "all"
    refreshPhotosForManage();
    setHeaderSolid();
  }

  function renderUser() {
    const user = LefamiStorage.getUser();
    const chip = $("user-chip");
    const signinHdr = $("btn-signin-header");
    if (user && LefamiStorage.isSignedIn()) {
      show(chip, true);
      show(signinHdr, false);
      $("user-name").textContent = user.name || "";
      if (user.picture) {
        $("user-avatar").src = user.picture;
        $("user-avatar").classList.remove("hidden");
      } else {
        $("user-avatar").classList.add("hidden");
      }
    } else if (LefamiStorage.mode === "demo") {
      show(chip, true);
      show(signinHdr, false);
      $("user-name").textContent = "Demo";
      $("user-avatar").classList.add("hidden");
    } else {
      show(chip, false);
      show(signinHdr, true);
    }
  }

  function renderFamilies() {
    const list = $("families-list");
    if (!list) return;
    list.innerHTML = state.families
      .map(
        (f) => `
      <button type="button" class="family-chip ${
        f.id === state.activeFamilyId ? "is-active" : ""
      }" role="tab" aria-selected="${f.id === state.activeFamilyId}" data-id="${f.id}">
        ${escapeHtml(f.name)}
      </button>`
      )
      .join("");

    list.querySelectorAll(".family-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeFamilyId = btn.dataset.id;
        renderFamilies();
        updateSubtitle();
        refreshPhotos();
      });
    });

    if (window.LefamiUpload) {
      LefamiUpload.fillFamilies(
        state.families,
        state.activeFamilyId === "all"
          ? state.families.find((f) => f.id !== "all")?.id
          : state.activeFamilyId
      );
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function refreshFamilies() {
    state.families = await LefamiStorage.listFamilies();
    if (!state.families.some((f) => f.id === state.activeFamilyId)) {
      state.activeFamilyId = "all";
    }
    renderFamilies();
    updateSubtitle();
  }

  async function refreshPhotos() {
    try {
      const familyId =
        LefamiTimeline.getPageMode() === "manage" ? "all" : state.activeFamilyId;
      const photos = await LefamiStorage.listPhotos(familyId, state.families);
      LefamiTimeline.setPhotos(photos);
    } catch (err) {
      console.error(err);
      const msg = String(err && err.message ? err.message : err);
      if (/innerHTML|null is not|Cannot set properties of null/i.test(msg)) {
        console.warn("Giao diện lệch phiên bản. Hãy Ctrl+F5 để tải lại.");
        return;
      }
      alert("Không tải được ảnh: " + msg);
    }
  }

  async function refreshPhotosForManage() {
    try {
      const photos = await LefamiStorage.listPhotos("all", state.families);
      LefamiTimeline.setPhotos(photos);
    } catch (err) {
      console.error(err);
    }
  }

  async function enterApp() {
    show($("auth-gate"), false);
    renderUser();
    await refreshFamilies();
    await refreshPhotos();
    state.ready = true;
  }

  async function handleSignIn() {
    const errEl = $("auth-error");
    show(errEl, false);
    try {
      $("btn-signin").disabled = true;
      $("btn-signin").textContent = "Đang đăng nhập...";
      await LefamiStorage.signIn();
      await enterApp();
    } catch (err) {
      console.error(err);
      errEl.textContent = err.message || "Đăng nhập thất bại.";
      show(errEl, true);
    } finally {
      $("btn-signin").disabled = false;
      $("btn-signin").textContent = "Đăng nhập với Google";
    }
  }

  async function handleSignOut() {
    await LefamiStorage.signOut();
    if (LefamiStorage.mode === "drive") {
      goHome();
      show($("auth-gate"), true);
      LefamiTimeline.setPhotos([]);
      renderUser();
    }
  }

  async function createFamily() {
    const name = $("family-name").value.trim();
    if (!name) return;
    try {
      $("btn-create-family").disabled = true;
      const fam = await LefamiStorage.createFamily(name);
      $("family-modal").close();
      $("family-name").value = "";
      state.activeFamilyId = fam.id;
      await refreshFamilies();
      await refreshPhotos();
    } catch (err) {
      alert(err.message || "Không tạo được gia đình");
    } finally {
      $("btn-create-family").disabled = false;
    }
  }

  function openUpload() {
    if (LefamiStorage.mode === "drive" && !LefamiStorage.isSignedIn()) {
      show($("auth-gate"), true);
      return;
    }
    LefamiUpload.fillFamilies(
      state.families,
      state.activeFamilyId === "all"
        ? state.families.find((f) => f.id !== "all")?.id
        : state.activeFamilyId
    );
    LefamiUpload.open();
  }

  function closeFamilyModal() {
    const modal = $("family-modal");
    if (modal?.open) modal.close();
    $("family-name").value = "";
  }

  function bindUi() {
    let scrollTicking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (scrollTicking) return;
        scrollTicking = true;
        requestAnimationFrame(() => {
          setHeaderSolid();
          scrollTicking = false;
        });
      },
      { passive: true }
    );
    setHeaderSolid();

    $("btn-signin")?.addEventListener("click", handleSignIn);
    $("btn-signin-header")?.addEventListener("click", handleSignIn);
    $("btn-signout")?.addEventListener("click", handleSignOut);
    $("btn-upload")?.addEventListener("click", openUpload);
    $("btn-my-photos")?.addEventListener("click", goManage);
    $("btn-back-home")?.addEventListener("click", goHome);
    $("logo")?.addEventListener("click", (e) => {
      if (LefamiTimeline.getPageMode() === "manage") {
        e.preventDefault();
        goHome();
      }
    });

    $("btn-scroll-gallery")?.addEventListener("click", () => {
      $("gallery")?.scrollIntoView({ behavior: "smooth" });
    });

    $("btn-new-family")?.addEventListener("click", () => {
      if (LefamiStorage.mode === "drive" && !LefamiStorage.isSignedIn()) {
        show($("auth-gate"), true);
        return;
      }
      $("family-modal").showModal();
    });
    $("btn-create-family")?.addEventListener("click", createFamily);

    const familyModal = $("family-modal");
    familyModal?.querySelectorAll("[data-close-family]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        closeFamilyModal();
      });
    });
    familyModal?.addEventListener("click", (e) => {
      if (e.target === familyModal) closeFamilyModal();
    });

    $("sort-order")?.addEventListener("change", (e) => {
      LefamiTimeline.setSort(e.target.value);
    });

    $("btn-dismiss-demo")?.addEventListener("click", () => show($("demo-banner"), false));

    LefamiTimeline.bindChrome();
    LefamiUpload.bind(async () => {
      await refreshPhotos();
    });
  }

  async function boot() {
    bindUi();
    const mode = await LefamiStorage.init();

    if (mode === "demo") {
      show($("demo-banner"), true);
      show($("auth-gate"), false);
      await LefamiStorage.signIn();
      await enterApp();
      return;
    }

    show($("auth-gate"), true);
    renderUser();
    try {
      if (await LefamiStorage.tryRestore()) await enterApp();
    } catch (err) {
      console.warn("Không khôi phục được phiên", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
