/**
 * Gallery: Album lưới + Timeline + Hero strip + Lightbox + Download
 */
window.LefamiTimeline = (() => {
  let photos = [];
  let sortOrder = "desc";
  let viewMode = localStorage.getItem("lefami_view") || "album";
  let gridCols = Number(localStorage.getItem("lefami_grid") || 3);
  let lightboxIndex = 0;
  let heroTimer = null;
  let heroVisible = true;

  const els = {};

  function cacheEls() {
    els.album = document.getElementById("album-root");
    els.timeline = document.getElementById("timeline-root");
    els.empty =
      document.getElementById("gallery-empty") ||
      document.getElementById("timeline-empty");
    els.count = document.getElementById("photo-count");
    els.subtitle = document.getElementById("gallery-subtitle");
    els.heroTrack = document.getElementById("hero-track");
    els.heroStrip = document.getElementById("hero-strip");
    els.hero = document.querySelector(".hero");
    els.lightbox = document.getElementById("lightbox");
    els.lightboxImg = document.getElementById("lightbox-img");
    els.lightboxCaption = document.getElementById("lightbox-caption");
    els.gridWrap = document.getElementById("grid-size-wrap");
    els.gridSize = document.getElementById("grid-size");
  }

  function sorted() {
    const list = photos.slice();
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
    if (!img || img.dataset.recovered) return;
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
    try {
      render();
    } catch (err) {
      console.error("Lefami render:", err);
    }
    try {
      renderHero();
    } catch (err) {
      console.error("Lefami hero:", err);
    }
  }

  function setSort(order) {
    sortOrder = order;
    render();
  }

  function setView(mode) {
    viewMode = mode === "timeline" ? "timeline" : "album";
    try {
      localStorage.setItem("lefami_view", viewMode);
    } catch (_) {}
    document.querySelectorAll(".view-toggle__btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.view === viewMode);
    });
    render();
  }

  function setGrid(cols) {
    gridCols = Math.min(6, Math.max(2, Number(cols) || 3));
    try {
      localStorage.setItem("lefami_grid", String(gridCols));
    } catch (_) {}
    if (els.gridSize) els.gridSize.value = String(gridCols);
    render();
  }

  function toggleEmpty(show) {
    if (!els.empty) return;
    els.empty.classList.toggle("hidden", !show);
  }

  function render() {
    cacheEls();
    const list = sorted();
    if (els.count) els.count.textContent = list.length + " ảnh";

    const showAlbum = viewMode === "album";
    if (els.album) {
      els.album.className =
        "album-grid cols-" + gridCols + (showAlbum ? "" : " hidden");
    }
    if (els.timeline) {
      els.timeline.classList.toggle("hidden", showAlbum);
    }
    if (els.gridWrap) {
      els.gridWrap.classList.toggle("hidden", !showAlbum);
    }

    if (!list.length) {
      if (els.album) els.album.innerHTML = "";
      if (els.timeline) els.timeline.innerHTML = "";
      toggleEmpty(true);
      return;
    }
    toggleEmpty(false);

    if (showAlbum) renderAlbum(list);
    else renderTimeline(list);
  }

  function renderAlbum(list) {
    if (!els.album) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < list.length; i++) {
      const photo = list[i];
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "album-cell";
      cell.title = photo.note || photo.name || "";
      cell.innerHTML =
        '<img src="' +
        thumb(photo) +
        '" alt="" loading="lazy" decoding="async" width="320" height="320" />' +
        '<span class="album-cell__meta">' +
        '<span class="album-cell__date">' +
        LefamiExif.formatShort(photo.takenAt || photo.createdTime) +
        "</span>" +
        (photo.familyName
          ? '<span class="album-cell__fam">' +
            escapeHtml(photo.familyName) +
            "</span>"
          : "") +
        "</span>" +
        '<span class="album-cell__dl" data-dl="1" title="Tải về">↓</span>';
      const img = cell.querySelector("img");
      img.addEventListener("error", function () {
        recoverImage(img, photo);
      }, { once: true });
      cell.addEventListener("click", function (e) {
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
    if (!els.timeline) return;
    const byYear = new Map();
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const y = LefamiExif.yearOf(p.takenAt || p.createdTime);
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(p);
    }
    const years = Array.from(byYear.keys()).sort(function (a, b) {
      if (a === "Khác") return 1;
      if (b === "Khác") return -1;
      return sortOrder === "asc" ? Number(a) - Number(b) : Number(b) - Number(a);
    });

    const frag = document.createDocumentFragment();
    for (let yi = 0; yi < years.length; yi++) {
      const year = years[yi];
      const yEl = document.createElement("div");
      yEl.className = "tl-year";
      yEl.innerHTML = "<span>" + year + "</span>";
      frag.appendChild(yEl);

      const yearPhotos = byYear.get(year);
      for (let pi = 0; pi < yearPhotos.length; pi++) {
        const photo = yearPhotos[pi];
        const item = document.createElement("article");
        item.className = "tl-item";
        item.innerHTML =
          '<div class="tl-node" aria-hidden="true"></div>' +
          '<div class="tl-card" role="button" tabindex="0">' +
          '<div class="tl-card__media"><img src="' +
          thumb(photo) +
          '" alt="" loading="lazy" decoding="async" width="400" height="300" /></div>' +
          '<div class="tl-card__body">' +
          '<p class="tl-card__date">' +
          LefamiExif.formatShort(photo.takenAt || photo.createdTime) +
          "</p>" +
          '<p class="tl-card__family">' +
          escapeHtml(photo.familyName || "") +
          "</p>" +
          '<p class="tl-card__note">' +
          escapeHtml(photo.note || photo.name || "") +
          "</p></div></div>";
        const card = item.querySelector(".tl-card");
        const img = item.querySelector("img");
        img.addEventListener("error", function () {
          recoverImage(img, photo);
        }, { once: true });
        card.addEventListener("click", function () {
          openLightbox(photo.id);
        });
        frag.appendChild(item);
      }
    }
    els.timeline.innerHTML = "";
    els.timeline.appendChild(frag);
  }

  function stopHero() {
    if (heroTimer) {
      clearInterval(heroTimer);
      heroTimer = null;
    }
  }

  /** Hero: dải ảnh ngang, object-fit contain, tự lướt ~10 ảnh mới nhất */
  function renderHero() {
    cacheEls();
    stopHero();
    if (!els.heroTrack || !els.heroStrip) return;

    const list = sorted().slice(0, 10);
    if (!list.length) {
      els.heroTrack.innerHTML =
        '<div class="hero__fallback-slide">Chưa có ảnh</div>';
      els.heroTrack.style.transform = "translateX(0)";
      return;
    }

    // Nhân đôi để lướt vòng mượt
    const loop = list.concat(list);
    els.heroTrack.innerHTML = loop
      .map(function (p) {
        return (
          '<figure class="hero__frame">' +
          '<img src="' +
          view(p) +
          '" alt="" decoding="async" loading="lazy" />' +
          "</figure>"
        );
      })
      .join("");

    els.heroTrack.querySelectorAll("img").forEach(function (img, i) {
      const photo = loop[i];
      img.addEventListener("error", function () {
        recoverImage(img, photo);
      }, { once: true });
    });

    let offset = 0;
    const speed = 0.45; // px / tick — nhẹ, không rAF nặng

    heroTimer = setInterval(function () {
      if (!heroVisible || !els.heroTrack || !els.heroStrip) return;
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      offset += speed;
      const half = els.heroTrack.scrollWidth / 2;
      if (half > 0 && offset >= half) offset = 0;
      els.heroTrack.style.transform = "translate3d(" + -offset + "px,0,0)";
    }, 32);
  }

  function openLightbox(id) {
    cacheEls();
    const list = sorted();
    lightboxIndex = Math.max(
      0,
      list.findIndex(function (p) {
        return p.id === id;
      })
    );
    showLightbox();
    if (els.lightbox && !els.lightbox.open) els.lightbox.showModal();
  }

  function showLightbox() {
    const list = sorted();
    if (!list.length || !els.lightboxImg) return;
    const photo = list[lightboxIndex];
    els.lightboxImg.src = view(photo);
    if (els.lightboxCaption) {
      els.lightboxCaption.textContent = [
        LefamiExif.formatDisplay(photo.takenAt || photo.createdTime),
        photo.familyName,
        photo.note,
        photo.uploadedBy ? "Đăng bởi " + photo.uploadedBy : "",
      ]
        .filter(Boolean)
        .join(" · ");
    }
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
      var blob;
      if (LefamiStorage.mode === "drive" && LefamiStorage.fetchBlobUrl) {
        var url = await LefamiStorage.fetchBlobUrl(photo.id);
        photo._blobUrl = url;
        blob = await (await fetch(url)).blob();
      } else {
        blob = await (await fetch(view(photo))).blob();
      }
      var a = document.createElement("a");
      var objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = photo.name || "lefami-" + photo.id + ".jpg";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(objectUrl);
      }, 2500);
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
    var list = sorted();
    if (list[lightboxIndex]) downloadPhoto(list[lightboxIndex]);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function lbCloseSafe() {
    if (els.lightbox && els.lightbox.open) els.lightbox.close();
  }

  function bindChrome() {
    cacheEls();
    if (els.gridSize) els.gridSize.value = String(gridCols);

    var btnAlbum = document.getElementById("btn-view-album");
    var btnTimeline = document.getElementById("btn-view-timeline");
    if (btnAlbum) btnAlbum.addEventListener("click", function () { setView("album"); });
    if (btnTimeline) btnTimeline.addEventListener("click", function () { setView("timeline"); });
    if (els.gridSize) {
      els.gridSize.addEventListener("change", function (e) {
        setGrid(e.target.value);
      });
    }

    var lbClose = document.getElementById("lightbox-close");
    var lbPrev = document.getElementById("lightbox-prev");
    var lbNext = document.getElementById("lightbox-next");
    var lbDl = document.getElementById("lightbox-download");
    if (lbClose) lbClose.addEventListener("click", lbCloseSafe);
    if (lbPrev) lbPrev.addEventListener("click", function () { lightboxNav(-1); });
    if (lbNext) lbNext.addEventListener("click", function () { lightboxNav(1); });
    if (lbDl) lbDl.addEventListener("click", downloadCurrent);
    if (els.lightbox) {
      els.lightbox.addEventListener("click", function (e) {
        if (e.target === els.lightbox) lbCloseSafe();
      });
      els.lightbox.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") lightboxNav(-1);
        if (e.key === "ArrowRight") lightboxNav(1);
      });
    }

    if (els.hero && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          heroVisible = entries[0] && entries[0].isIntersecting;
        },
        { threshold: 0.1 }
      );
      io.observe(els.hero);
    }

    setView(viewMode);
  }

  return {
    setPhotos: setPhotos,
    setSort: setSort,
    setView: setView,
    setGrid: setGrid,
    openLightbox: openLightbox,
    bindChrome: bindChrome,
    downloadPhoto: downloadPhoto,
    getPhotos: sorted,
  };
})();
