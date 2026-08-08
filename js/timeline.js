/**
 * Gallery + hero strip + lightbox (vuốt / zoom mượt trên mobile)
 */
window.LefamiTimeline = (() => {
  let photos = [];
  let sortOrder = "desc";
  let viewMode = localStorage.getItem("lefami_view") || "album";
  let gridCols = Number(localStorage.getItem("lefami_grid") || 3);
  let lightboxIndex = 0;
  let heroTimer = null;
  let heroVisible = true;
  let scrollLockY = 0;
  let lbOpen = false;

  const els = {};

  /* —— Zoom / pan state —— */
  const z = {
    scale: 1,
    x: 0,
    y: 0,
    min: 1,
    max: 4,
  };
  let pointers = new Map();
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let panStart = null;
  let swipeStart = null;
  let lastTap = 0;
  let animating = false;

  function cacheEls() {
    els.album = document.getElementById("album-root");
    els.timeline = document.getElementById("timeline-root");
    els.empty =
      document.getElementById("gallery-empty") ||
      document.getElementById("timeline-empty");
    els.count = document.getElementById("photo-count");
    els.heroTrack = document.getElementById("hero-track");
    els.heroStrip = document.getElementById("hero-strip");
    els.hero = document.querySelector(".hero");
    els.lightbox = document.getElementById("lightbox");
    els.stage = document.getElementById("lightbox-stage");
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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
    if (els.timeline) els.timeline.classList.toggle("hidden", showAlbum);
    if (els.gridWrap) els.gridWrap.classList.toggle("hidden", !showAlbum);

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
        '<span class="album-cell__meta"><span class="album-cell__date">' +
        LefamiExif.formatShort(photo.takenAt || photo.createdTime) +
        "</span>" +
        (photo.familyName
          ? '<span class="album-cell__fam">' + escapeHtml(photo.familyName) + "</span>"
          : "") +
        '</span><span class="album-cell__dl" data-dl="1" title="Tải về">↓</span>';
      const img = cell.querySelector("img");
      if (img) {
        img.addEventListener("error", function () {
          recoverImage(img, photo);
        }, { once: true });
      }
      cell.addEventListener("click", function (e) {
        if (e.target.closest && e.target.closest("[data-dl]")) {
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
          '<div class="tl-card__body"><p class="tl-card__date">' +
          LefamiExif.formatShort(photo.takenAt || photo.createdTime) +
          '</p><p class="tl-card__family">' +
          escapeHtml(photo.familyName || "") +
          '</p><p class="tl-card__note">' +
          escapeHtml(photo.note || photo.name || "") +
          "</p></div></div>";
        const card = item.querySelector(".tl-card");
        const img = item.querySelector("img");
        if (img) {
          img.addEventListener("error", function () {
            recoverImage(img, photo);
          }, { once: true });
        }
        if (card) {
          card.addEventListener("click", function () {
            openLightbox(photo.id);
          });
        }
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

    const loop = list.concat(list);
    els.heroTrack.innerHTML = loop
      .map(function (p) {
        return (
          '<figure class="hero__frame"><img src="' +
          view(p) +
          '" alt="" decoding="async" loading="lazy" /></figure>'
        );
      })
      .join("");

    els.heroTrack.querySelectorAll("img").forEach(function (img, i) {
      img.addEventListener("error", function () {
        recoverImage(img, loop[i]);
      }, { once: true });
    });

    let offset = 0;
    const speed = 0.4;
    heroTimer = setInterval(function () {
      if (lbOpen || !heroVisible || !els.heroTrack) return;
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        return;
      offset += speed;
      const half = els.heroTrack.scrollWidth / 2;
      if (half > 0 && offset >= half) offset = 0;
      els.heroTrack.style.transform = "translate3d(" + -offset + "px,0,0)";
    }, 40);
  }

  /* ========== Lightbox ========== */

  function lockBody() {
    scrollLockY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.classList.add("lb-open");
    document.body.classList.add("lb-open");
    document.body.style.top = "-" + scrollLockY + "px";
  }

  function unlockBody() {
    document.documentElement.classList.remove("lb-open");
    document.body.classList.remove("lb-open");
    document.body.style.top = "";
    window.scrollTo(0, scrollLockY);
  }

  function applyZoom(animate) {
    if (!els.lightboxImg) return;
    els.lightboxImg.style.transition = animate
      ? "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)"
      : "none";
    els.lightboxImg.style.transform =
      "translate3d(" + z.x + "px," + z.y + "px,0) scale(" + z.scale + ")";
  }

  function resetZoom(animate) {
    z.scale = 1;
    z.x = 0;
    z.y = 0;
    applyZoom(!!animate);
    if (els.stage) els.stage.classList.toggle("is-zoomed", false);
  }

  function clampPan() {
    if (!els.lightboxImg || !els.stage) return;
    const rect = els.stage.getBoundingClientRect();
    const iw = els.lightboxImg.offsetWidth * z.scale;
    const ih = els.lightboxImg.offsetHeight * z.scale;
    const maxX = Math.max(0, (iw - rect.width) / 2);
    const maxY = Math.max(0, (ih - rect.height) / 2);
    z.x = Math.min(maxX, Math.max(-maxX, z.x));
    z.y = Math.min(maxY, Math.max(-maxY, z.y));
  }

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
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
    showLightbox(false);
    if (els.lightbox && !els.lightbox.open) {
      els.lightbox.showModal();
      lbOpen = true;
      lockBody();
    }
  }

  function showLightbox(keepZoom) {
    const list = sorted();
    if (!list.length || !els.lightboxImg) return;
    const photo = list[lightboxIndex];
    if (!keepZoom) resetZoom(false);
    // Tránh nháy: ẩn nhẹ rồi hiện
    els.lightboxImg.style.opacity = "0.01";
    const onLoad = function () {
      els.lightboxImg.style.opacity = "1";
      els.lightboxImg.removeEventListener("load", onLoad);
    };
    els.lightboxImg.addEventListener("load", onLoad);
    els.lightboxImg.src = view(photo);
    if (els.lightboxImg.complete) onLoad();

    if (els.lightboxCaption) {
      els.lightboxCaption.textContent = [
        LefamiExif.formatDisplay(photo.takenAt || photo.createdTime),
        photo.familyName,
        photo.note,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    const counter = document.getElementById("lightbox-counter");
    if (counter) counter.textContent = lightboxIndex + 1 + " / " + list.length;
  }

  function lightboxNav(dir) {
    if (animating) return;
    const list = sorted();
    if (!list.length) return;
    lightboxIndex = (lightboxIndex + dir + list.length) % list.length;
    showLightbox(false);
  }

  function lbCloseSafe() {
    if (!els.lightbox) return;
    resetZoom(false);
    pointers.clear();
    lbOpen = false;
    if (els.lightbox.open) els.lightbox.close();
    unlockBody();
  }

  function onPointerDown(e) {
    if (!els.stage || !els.lightbox || !els.lightbox.open) return;
    if (e.target.closest && e.target.closest(".lightbox__top, .lightbox__nav, .lightbox__foot, .lightbox__caption"))
      return;
    els.stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      pinchStartDist = dist(pts[0], pts[1]) || 1;
      pinchStartScale = z.scale;
      panStart = null;
      swipeStart = null;
    } else if (pointers.size === 1) {
      // Luôn ghi nhận điểm chạm để double-tap zoom in/out
      swipeStart = { x: e.clientX, y: e.clientY, t: Date.now() };
      if (z.scale > 1.05) {
        panStart = { x: e.clientX, y: e.clientY, ox: z.x, oy: z.y };
      } else {
        panStart = null;
      }
    }
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      e.preventDefault();
      const pts = Array.from(pointers.values());
      const d = dist(pts[0], pts[1]) || 1;
      z.scale = Math.min(z.max, Math.max(z.min, pinchStartScale * (d / pinchStartDist)));
      clampPan();
      applyZoom(false);
      if (els.stage) els.stage.classList.toggle("is-zoomed", z.scale > 1.05);
      return;
    }

    if (pointers.size === 1 && panStart && z.scale > 1.05) {
      e.preventDefault();
      z.x = panStart.ox + (e.clientX - panStart.x);
      z.y = panStart.oy + (e.clientY - panStart.y);
      clampPan();
      applyZoom(false);
      // Nếu kéo xa thì không tính double-tap
      if (swipeStart) {
        const mdx = e.clientX - swipeStart.x;
        const mdy = e.clientY - swipeStart.y;
        if (Math.abs(mdx) > 12 || Math.abs(mdy) > 12) swipeStart.moved = true;
      }
    }
  }

  function onPointerUp(e) {
    if (!pointers.has(e.pointerId)) return;
    const start = swipeStart;
    pointers.delete(e.pointerId);

    if (pointers.size < 2) {
      pinchStartDist = 0;
    }
    if (pointers.size === 0) {
      panStart = null;
      const now = Date.now();

      if (start && !start.moved) {
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        const dt = now - start.t;
        const isTap = Math.abs(dx) < 12 && Math.abs(dy) < 12 && dt < 350;

        // Vuốt ngang chỉ khi chưa zoom
        if (!isTap && z.scale <= 1.05) {
          if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.2 && dt < 450) {
            lightboxNav(dx < 0 ? 1 : -1);
            swipeStart = null;
            return;
          }
        }

        // Double-tap: zoom in <-> zoom out
        if (isTap) {
          if (now - lastTap < 340) {
            if (z.scale > 1.05) {
              resetZoom(true);
            } else {
              z.scale = 2.2;
              z.x = 0;
              z.y = 0;
              applyZoom(true);
              if (els.stage) els.stage.classList.add("is-zoomed");
            }
            lastTap = 0;
          } else {
            lastTap = now;
          }
        }
      }

      swipeStart = null;
      if (z.scale <= 1.02) resetZoom(true);
      else {
        clampPan();
        applyZoom(true);
      }
    }
  }

  function bindLightboxGestures() {
    cacheEls();
    if (!els.stage || els.stage.dataset.bound) return;
    els.stage.dataset.bound = "1";

    els.stage.addEventListener("pointerdown", onPointerDown);
    els.stage.addEventListener("pointermove", onPointerMove, { passive: false });
    els.stage.addEventListener("pointerup", onPointerUp);
    els.stage.addEventListener("pointercancel", onPointerUp);
    els.stage.addEventListener(
      "wheel",
      function (e) {
        if (!els.lightbox || !els.lightbox.open) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.12 : 0.12;
        z.scale = Math.min(z.max, Math.max(z.min, z.scale + delta));
        if (z.scale <= 1.02) resetZoom(true);
        else {
          clampPan();
          applyZoom(false);
          els.stage.classList.add("is-zoomed");
        }
      },
      { passive: false }
    );

    // Chặn cuộn nền khi chạm lightbox
    els.lightbox.addEventListener(
      "touchmove",
      function (e) {
        if (e.target.closest && e.target.closest(".lightbox__caption")) return;
        e.preventDefault();
      },
      { passive: false }
    );
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

  function bindChrome() {
    cacheEls();
    if (els.gridSize) els.gridSize.value = String(gridCols);

    // Mobile mặc định 2 cột nếu chưa chọn
    if (window.matchMedia && window.matchMedia("(max-width: 640px)").matches) {
      if (!localStorage.getItem("lefami_grid")) setGrid(2);
    }

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
      els.lightbox.addEventListener("close", function () {
        lbOpen = false;
        unlockBody();
        resetZoom(false);
        pointers.clear();
      });
      els.lightbox.addEventListener("cancel", function () {
        lbOpen = false;
        unlockBody();
      });
      els.lightbox.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") lightboxNav(-1);
        if (e.key === "ArrowRight") lightboxNav(1);
        if (e.key === "Escape") lbCloseSafe();
      });
    }

    bindLightboxGestures();

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
