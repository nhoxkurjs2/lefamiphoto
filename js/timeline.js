/** Timeline + hero slideshow + memory theater + lightbox */
window.LefamiTimeline = (() => {
  let photos = [];
  let sortOrder = "desc";
  let heroTimer = null;
  let heroIndex = 0;
  let theaterTimer = null;
  let theaterIndex = 0;
  let lightboxIndex = 0;
  let observer = null;

  const els = {};

  function cacheEls() {
    els.root = document.getElementById("timeline-root");
    els.empty = document.getElementById("timeline-empty");
    els.count = document.getElementById("photo-count");
    els.subtitle = document.getElementById("timeline-subtitle");
    els.heroMedia = document.getElementById("hero-media");
    els.heroProgress = document.getElementById("hero-progress");
    els.lightbox = document.getElementById("lightbox");
    els.lightboxImg = document.getElementById("lightbox-img");
    els.lightboxCaption = document.getElementById("lightbox-caption");
    els.theater = document.getElementById("theater");
    els.theaterImg = document.getElementById("theater-img");
    els.theaterCaption = document.getElementById("theater-caption");
    els.theaterDate = document.getElementById("theater-date");
    els.theaterBar = document.getElementById("theater-bar");
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
    } catch (e) {
      console.warn("Không khôi phục được ảnh", e);
    }
  }

  function thumb(photo) {
    return photo._blobUrl || window.LefamiStorage.getThumbnailUrl(photo);
  }

  function view(photo) {
    return photo._blobUrl || window.LefamiStorage.getViewUrl(photo) || thumb(photo);
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

  function render() {
    cacheEls();
    const list = sorted();
    els.count.textContent = `${list.length} ảnh`;

    if (!list.length) {
      els.root.innerHTML = "";
      els.empty.classList.remove("hidden");
      return;
    }
    els.empty.classList.add("hidden");

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
        item.dataset.id = photo.id;

        const node = document.createElement("div");
        node.className = "tl-node";
        node.setAttribute("aria-hidden", "true");

        const card = document.createElement("div");
        card.className = "tl-card";
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.innerHTML = `
          <div class="tl-card__media">
            <img src="${thumb(photo)}" alt="${escapeAttr(photo.note || photo.name)}" loading="lazy" data-id="${photo.id}" />
          </div>
          <div class="tl-card__body">
            <p class="tl-card__date">${LefamiExif.formatShort(photo.takenAt || photo.createdTime)}</p>
            <p class="tl-card__family">${escapeHtml(photo.familyName || "")}</p>
            <p class="tl-card__note">${escapeHtml(photo.note || photo.name || "")}</p>
          </div>
        `;
        const img = card.querySelector("img");
        img.addEventListener("error", () => recoverImage(img, photo));
        card.addEventListener("click", () => openLightbox(photo.id));
        card.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openLightbox(photo.id);
          }
        });

        item.appendChild(node);
        item.appendChild(card);
        frag.appendChild(item);
      }
    }

    els.root.innerHTML = "";
    els.root.appendChild(frag);
    observeItems();
  }

  function observeItems() {
    if (observer) observer.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add("is-in");
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".tl-item").forEach((el) => observer.observe(el));
  }

  function renderHero() {
    cacheEls();
    const list = sorted();
    clearInterval(heroTimer);
    heroIndex = 0;

    if (!list.length) {
      els.heroMedia.innerHTML = `
        <div class="hero__slide is-active" data-fallback="true">
          <div class="hero__fallback"></div>
        </div>`;
      els.heroProgress.style.setProperty("--p", "0%");
      return;
    }

    const slides = list.slice(0, 12);
    els.heroMedia.innerHTML = slides
      .map(
        (p, i) => `
      <div class="hero__slide ${i === 0 ? "is-active" : ""}">
        <img src="${view(p)}" alt="" />
      </div>`
      )
      .join("");

    let t = 0;
    const duration = 5500;
    const step = 50;
    heroTimer = setInterval(() => {
      t += step;
      const pct = Math.min(100, (t / duration) * 100);
      els.heroProgress.style.setProperty("--p", pct + "%");
      if (t >= duration) {
        t = 0;
        const nodes = els.heroMedia.querySelectorAll(".hero__slide");
        nodes[heroIndex]?.classList.remove("is-active");
        heroIndex = (heroIndex + 1) % nodes.length;
        nodes[heroIndex]?.classList.add("is-active");
      }
    }, step);
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
    const parts = [
      LefamiExif.formatDisplay(photo.takenAt || photo.createdTime),
      photo.familyName,
      photo.note,
      photo.uploadedBy ? `Đăng bởi ${photo.uploadedBy}` : "",
    ].filter(Boolean);
    els.lightboxCaption.textContent = parts.join(" · ");
  }

  function lightboxNav(dir) {
    const list = sorted();
    if (!list.length) return;
    lightboxIndex = (lightboxIndex + dir + list.length) % list.length;
    showLightbox();
  }

  function startTheater() {
    cacheEls();
    const list = sorted();
    if (!list.length) return;
    theaterIndex = 0;
    els.theater.classList.remove("hidden");
    els.theater.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    playTheaterSlide();
  }

  function playTheaterSlide() {
    clearTimeout(theaterTimer);
    const list = sorted();
    if (!list.length) return stopTheater();
    const photo = list[theaterIndex % list.length];
    els.theaterImg.classList.remove("is-on");
    // Force reflow for fade
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
    const start = performance.now();
    function bar(now) {
      const p = Math.min(1, (now - start) / duration);
      els.theaterBar.style.width = p * 100 + "%";
      if (p < 1 && !els.theater.classList.contains("hidden")) {
        requestAnimationFrame(bar);
      }
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
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function bindChrome() {
    cacheEls();
    document.getElementById("lightbox-close")?.addEventListener("click", () => els.lightbox.close());
    document.getElementById("lightbox-prev")?.addEventListener("click", () => lightboxNav(-1));
    document.getElementById("lightbox-next")?.addEventListener("click", () => lightboxNav(1));
    els.lightbox?.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") lightboxNav(-1);
      if (e.key === "ArrowRight") lightboxNav(1);
    });
    document.getElementById("theater-exit")?.addEventListener("click", stopTheater);
    document.getElementById("btn-play")?.addEventListener("click", startTheater);
  }

  return {
    setPhotos,
    setSort,
    openLightbox,
    startTheater,
    stopTheater,
    bindChrome,
    getPhotos: () => sorted(),
  };
})();
