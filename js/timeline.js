/**
 * Gallery: Album lưới + Timeline + Hero + Lightbox + Download
 */
window.LefamiTimeline = (() => {
  let photos = [];
  let sortOrder = "desc";
  let viewMode = localStorage.getItem("lefami_view") || "album";
  let gridCols = Number(localStorage.getItem("lefami_grid") || 3);
  let heroIndex = 0;
  let theaterTimer = null;
  let theaterIndex = 0;
  let lightboxIndex = 0;
  let heroRaf = null;
  let heroPaused = false;
  let heroVisible = true;

  const els = {};

  function cacheEls() {
    els.album = document.getElementById("album-root");
    els.timeline = document.getElementById("timeline-root");
    els.empty = document.getElementById("gallery-empty");
    els.count = document.getElementById("photo-count");
    els.subtitle = document.getElementById("gallery-subtitle");
    els.heroMedia = document.getElementById("hero-media");
    els.heroProgress = document.getElementById("hero-progress");
    els.hero = document.querySelector(".hero");
    els.lightbox = document.getElementById("lightbox");
    els.lightboxImg = document.getElementById("lightbox-img");
    els.lightboxCaption = document.getElementById("lightbox-caption");
    els.theater = document.getElementById("theater");
    els.theaterImg = document.getElementById("theater-img");
    els.theaterCaption = document.getElementById("theater-caption");
    els.theaterDate = document.getElementById("theater-date");
    els.theaterBar = document.getElementById("theater-bar");
    els.gridWrap = document.getElementById("grid-size-wrap");
    els.gridSize = document.getElementById("grid-size");
  }

  function sorted() {
    const list = [...photos];
    list.sort((a, b) => {
      const ta = new Date(a.takenAt || a.createdTime || 0).getTime();
      const tb = new Date(b.takenAt || b.createdTime || 0).getTime();
      return sortOrder === "asc" ? ta - tb : tb - ta;
    });
    return list;
  }

  function thumb(photo) {
    return photo._blobUrl || LefamiStorage.getThumbnailUrl(photo);
  }

  function view(photo) {
    return photo._blobUrl || LefamiStorage.getViewUrl(photo) || thumb(photo);
  }

  async function recoverImage(img, photo) {
    if (img.dataset.recovered) return;
    img.dataset.recovered = "1";
    try {
      if (LefamiStorage.mode === "drive" && LefamiStorage.fetchBlobUrl) {
        const url = await LefamiStorage.fetchBlobUrl(photo.id);
        if (url) {
          photo._blobUrl = url;
          img.src = url;
        }
      }
    } catch (_) {}
  }

  function setPhotos(list) {
    photos = list || [];
    render();
    renderHero();
  }

  function setSort(order) {
    sortOrder = order;
    render();
  }

  function setView(mode) {
    viewMode = mode === "timeline" ? "timeline" : "album";
    localStorage.setItem("lefami_view", viewMode);
    document.querySelectorAll(".view-toggle__btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.view === viewMode);
    });
    render();
  }

  function setGrid(cols) {
    gridCols = Math.min(6, Math.max(2, Number(cols) || 3));
    localStorage.setItem("lefami_grid", String(gridCols));
    if (els.gridSize) els.gridSize.value = String(gridCols);
    if (els.album) {
      els.album.className = `album-grid cols-${gridCols}`;
    }
  }

  function render() {
    cacheEls();
    const list = sorted();
    if (els.count) els.count.textContent = `${list.length} ảnh`;

    const showAlbum = viewMode === "album";
    els.album?.classList.toggle("hidden", !showAlbum);
    els.timeline?.classList.toggle("hidden", showAlbum);
    els.gridWrap?.classList.toggle("hidden", !showAlbum);

    if (els.album) els.album.className = `album-grid cols-${gridCols}${showAlbum ? "" : " hidden"}`;

    if (!list.length) {
      if (els.album) els.album.innerHTML = "";
      if (els.timeline) els.timeline.innerHTML = "";
      els.empty?.classList.remove("hidden");
      return;
    }
    els.empty?.classList.add("hidden");

    if (showAlbum) renderAlbum(list);
    else renderTimeline(list);
  }

  function renderAlbum(list) {
    const frag = document.createDocumentFragment();
    for (const photo of list) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "album-cell";
      cell.title = photo.note || photo.name || "";
      cell.innerHTML = `
        <img src="${thumb(photo)}" alt="" loading="lazy" decoding="async" width="320" height="320" />
        <span class="album-cell__meta">
          <span class="album-cell__date">${LefamiExif.formatShort(photo.takenAt || photo.createdTime)}</span>
          ${photo.familyName ? `<span class="album-cell__fam">${escapeHtml(photo.familyName)}</span>` : ""}
        </span>
        <span class="album-cell__dl" data-dl="${photo.id}" title="Tải về">↓</span>
      `;
      const img = cell.querySelector("img");
      img.addEventListener("error", () => recoverImage(img, photo), { once: true });
      cell.addEventListener("click", (e) => {
        if (e.target.closest("[data-dl]")) {
          e.stopPropagation();
          downloadPhoto(photo);
          return;
        }
        openLightbox(photo.id);
      });
      frag.appendChild(cell);
    }
    els.album.innerHTML = "";
    els.album.appendChild(frag);
  }

  function renderTimeline(list) {
    const byYear = new Map();
    for (const p of list) {
      const y = LefamiExif.yearOf(p.takenAt || p.createdTime);
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(p);
    }
    const years = [...byYear.keys()].sort((a, b) => {
      if (a === "Khác") return 1;
      if (b === "Khác") return -1;
      return sortOrder === "asc" ? Number(a) - Number(b) : Number(b) - Number(a);
    });

    const frag = document.createDocumentFragment();
    for (const year of years) {
      const yEl = document.createElement("div");
      yEl.className = "tl-year";
      yEl.innerHTML = `<span>${year}</span>`;
      frag.appendChild(yEl);

      for (const photo of byYear.get(year)) {
        const item = document.createElement("article");
        item.className = "tl-item";
        item.innerHTML = `
          <div class="tl-node" aria-hidden="true"></div>
          <div class="tl-card" role="button" tabindex="0">
            <div class="tl-card__media">
              <img src="${thumb(photo)}" alt="" loading="lazy" decoding="async" width="400" height="300" />
            </div>
            <div class="tl-card__body">
              <p class="tl-card__date">${LefamiExif.formatShort(photo.takenAt || photo.createdTime)}</p>
              <p class="tl-card__family">${escapeHtml(photo.familyName || "")}</p>
              <p class="tl-card__note">${escapeHtml(photo.note || photo.name || "")}</p>
            </div>
          </div>
        `;
        const card = item.querySelector(".tl-card");
        const img = item.querySelector("img");
        img.addEventListener("error", () => recoverImage(img, photo), { once: true });
        card.addEventListener("click", () => openLightbox(photo.id));
        frag.appendChild(item);
      }
    }
    els.timeline.innerHTML = "";
    els.timeline.appendChild(frag);
  }

  function stopHero() {
    if (heroRaf) cancelAnimationFrame(heroRaf);
    heroRaf = null;
  }

  function renderHero() {
    cacheEls();
    const list = sorted();
    stopHero();
    heroIndex = 0;

    if (!list.length) {
      els.heroMedia.innerHTML = `<div class="hero__slide is-active"><div class="hero__fallback"></div></div>`;
      els.heroProgress.style.setProperty("--p", "0%");
      return;
    }

    // Chỉ 3 ảnh hero, kích thước vừa
    const slides = list.slice(0, 3);
    els.heroMedia.innerHTML = slides
      .map(
        (p, i) => `
      <div class="hero__slide ${i === 0 ? "is-active" : ""}">
        <img src="${view(p)}" alt="" decoding="async" ${i ? 'loading="lazy"' : ""} />
      </div>`
      )
      .join("");

    const duration = 7000;
    let start = performance.now();

    function tick(now) {
      heroRaf = requestAnimationFrame(tick);
      if (heroPaused || !heroVisible) return;

      const elapsed = now - start;
      els.heroProgress.style.setProperty("--p", Math.min(100, (elapsed / duration) * 100) + "%");
      if (elapsed >= duration) {
        start = now;
        const nodes = els.heroMedia.querySelectorAll(".hero__slide");
        if (nodes.length) {
          nodes[heroIndex]?.classList.remove("is-active");
          heroIndex = (heroIndex + 1) % nodes.length;
          nodes[heroIndex]?.classList.add("is-active");
        }
      }
    }
    heroRaf = requestAnimationFrame(tick);
  }

  function openLightbox(id) {
    cacheEls();
    const list = sorted();
    lightboxIndex = Math.max(0, list.findIndex((p) => p.id === id));
    showLightbox();
    if (!els.lightbox.open) els.lightbox.showModal();
  }

  function showLightbox() {
    const list = sorted();
    if (!list.length) return;
    const photo = list[lightboxIndex];
    els.lightboxImg.src = view(photo);
    els.lightbox.dataset.photoId = photo.id;
    els.lightboxCaption.textContent = [
      LefamiExif.formatDisplay(photo.takenAt || photo.createdTime),
      photo.familyName,
      photo.note,
      photo.uploadedBy ? `Đăng bởi ${photo.uploadedBy}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function lightboxNav(dir) {
    const list = sorted();
    if (!list.length) return;
    lightboxIndex = (lightboxIndex + dir + list.length) % list.length;
    showLightbox();
  }

  async function downloadPhoto(photo) {
    if (!photo) return;
    const btn = document.getElementById("lightbox-download");
    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Đang tải...";
      }

      let blob;
      if (LefamiStorage.mode === "drive" && LefamiStorage.fetchBlobUrl) {
        const url = await LefamiStorage.fetchBlobUrl(photo.id);
        photo._blobUrl = url;
        blob = await (await fetch(url)).blob();
      } else {
        const url = view(photo);
        blob = await (await fetch(url)).blob();
      }

      const a = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = photo.name || `lefami-${photo.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2500);
    } catch (err) {
      console.error(err);
      alert("Không tải được ảnh. Thử lại sau.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Tải về";
      }
    }
  }

  function downloadCurrent() {
    const list = sorted();
    const photo = list[lightboxIndex];
    if (photo) downloadPhoto(photo);
  }

  function startTheater() {
    cacheEls();
    const list = sorted();
    if (!list.length) return;
    theaterIndex = 0;
    els.theater.classList.remove("hidden");
    els.theater.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    heroPaused = true;
    playTheaterSlide();
  }

  function playTheaterSlide() {
    clearTimeout(theaterTimer);
    const list = sorted();
    if (!list.length) return stopTheater();
    const photo = list[theaterIndex % list.length];
    els.theaterImg.classList.remove("is-on");
    void els.theaterImg.offsetWidth;
    els.theaterImg.src = view(photo);
    els.theaterCaption.textContent = photo.note || photo.name || "";
    els.theaterDate.textContent = [
      LefamiExif.formatDisplay(photo.takenAt || photo.createdTime),
      photo.familyName,
    ]
      .filter(Boolean)
      .join(" · ");
    requestAnimationFrame(() => els.theaterImg.classList.add("is-on"));

    const duration = 4500;
    const t0 = performance.now();
    function bar(now) {
      const p = Math.min(1, (now - t0) / duration);
      els.theaterBar.style.width = p * 100 + "%";
      if (p < 1 && !els.theater.classList.contains("hidden")) requestAnimationFrame(bar);
    }
    requestAnimationFrame(bar);
    theaterTimer = setTimeout(() => {
      theaterIndex += 1;
      playTheaterSlide();
    }, duration);
  }

  function stopTheater() {
    clearTimeout(theaterTimer);
    cacheEls();
    els.theater.classList.add("hidden");
    els.theater.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    heroPaused = false;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bindChrome() {
    cacheEls();
    if (els.gridSize) els.gridSize.value = String(gridCols);

    document.getElementById("btn-view-album")?.addEventListener("click", () => setView("album"));
    document.getElementById("btn-view-timeline")?.addEventListener("click", () => setView("timeline"));
    els.gridSize?.addEventListener("change", (e) => {
      setGrid(e.target.value);
    });

    document.getElementById("lightbox-close")?.addEventListener("click", () => els.lightbox.close());
    document.getElementById("lightbox-prev")?.addEventListener("click", () => lightboxNav(-1));
    document.getElementById("lightbox-next")?.addEventListener("click", () => lightboxNav(1));
    document.getElementById("lightbox-download")?.addEventListener("click", downloadCurrent);
    els.lightbox?.addEventListener("click", (e) => {
      if (e.target === els.lightbox) els.lightbox.close();
    });
    els.lightbox?.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") lightboxNav(-1);
      if (e.key === "ArrowRight") lightboxNav(1);
    });
    document.getElementById("theater-exit")?.addEventListener("click", stopTheater);
    document.getElementById("btn-play")?.addEventListener("click", startTheater);

    // Pause hero khi không nhìn thấy → nhẹ hơn
    if (els.hero && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        ([entry]) => {
          heroVisible = entry.isIntersecting;
        },
        { threshold: 0.15 }
      );
      io.observe(els.hero);
    }

    // Áp dụng view đã lưu
    setView(viewMode);
  }

  return {
    setPhotos,
    setSort,
    setView,
    setGrid,
    openLightbox,
    startTheater,
    stopTheater,
    bindChrome,
    downloadPhoto,
    getPhotos: () => sorted(),
  };
})();
