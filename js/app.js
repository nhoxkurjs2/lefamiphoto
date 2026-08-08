/** Lefami — bootstrap & orchestration */
(() => {
  const state = {
    families: [],
    activeFamilyId: "all",
    ready: false,
  };

  const $ = (id) => document.getElementById(id);

  function show(el, on = true) {
    el.classList.toggle("hidden", !on);
  }

  function setHeaderSolid() {
    const header = document.querySelector(".site-header");
    header.classList.toggle("is-solid", window.scrollY > window.innerHeight * 0.55);
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
        $("user-avatar").removeAttribute("src");
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
        refreshPhotos();
        const fam = state.families.find((f) => f.id === state.activeFamilyId);
        $("timeline-subtitle").textContent =
          state.activeFamilyId === "all"
            ? "Tất cả kỷ niệm, sắp xếp theo ngày chụp."
            : `Kỷ niệm của ${fam?.name || ""} — sắp xếp theo ngày chụp.`;
      });
    });

    LefamiUpload.fillFamilies(state.families, state.activeFamilyId === "all" ? state.families.find((f) => f.id !== "all")?.id : state.activeFamilyId);
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
  }

  async function refreshPhotos() {
    try {
      const photos = await LefamiStorage.listPhotos(state.activeFamilyId);
      LefamiTimeline.setPhotos(photos);
    } catch (err) {
      console.error(err);
      alert("Không tải được ảnh: " + (err.message || err));
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

  function bindUi() {
    window.addEventListener("scroll", setHeaderSolid, { passive: true });
    setHeaderSolid();

    $("btn-signin")?.addEventListener("click", handleSignIn);
    $("btn-signin-header")?.addEventListener("click", handleSignIn);
    $("btn-signout")?.addEventListener("click", handleSignOut);

    $("btn-upload")?.addEventListener("click", openUpload);
    $("btn-upload-hero")?.addEventListener("click", openUpload);
    $("btn-upload-empty")?.addEventListener("click", openUpload);

    $("btn-scroll-timeline")?.addEventListener("click", () => {
      $("timeline").scrollIntoView({ behavior: "smooth" });
    });

    $("btn-new-family")?.addEventListener("click", () => {
      if (LefamiStorage.mode === "drive" && !LefamiStorage.isSignedIn()) {
        show($("auth-gate"), true);
        return;
      }
      $("family-modal").showModal();
    });
    $("btn-create-family")?.addEventListener("click", createFamily);

    $("sort-order")?.addEventListener("change", (e) => {
      LefamiTimeline.setSort(e.target.value);
    });

    $("btn-dismiss-demo")?.addEventListener("click", () => {
      show($("demo-banner"), false);
    });

    LefamiTimeline.bindChrome();
    LefamiUpload.bind(async () => {
      await refreshFamilies();
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

    // Drive mode — require sign-in
    show($("auth-gate"), true);
    renderUser();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
