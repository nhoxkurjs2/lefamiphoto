/** Upload queue — EXIF date, note, family, batch upload */
window.LefamiUpload = (() => {
  let queue = [];
  let onUploadedCb = null;

  const $ = (id) => document.getElementById(id);

  function open() {
    const modal = $("upload-modal");
    if (!modal.open) modal.showModal();
  }

  function close() {
    resetQueue();
    const modal = $("upload-modal");
    if (modal?.open) modal.close();
  }

  function resetQueue() {
    queue.forEach((q) => {
      if (q.previewUrl) URL.revokeObjectURL(q.previewUrl);
    });
    queue = [];
    renderQueue();
    const btn = $("btn-start-upload");
    if (btn) btn.disabled = true;
    const status = $("upload-status");
    if (status) status.textContent = "";
    const note = $("upload-note");
    if (note) note.value = "";
  }

  async function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith("image/"));
    // Đọc EXIF song song, tối đa 4 file một lúc
    for (let i = 0; i < files.length; i += 4) {
      const slice = files.slice(i, i + 4);
      const results = await Promise.all(
        slice.map(async (file) => {
          const takenAt = await LefamiExif.readTakenAt(file);
          return {
            file,
            takenAt,
            previewUrl: URL.createObjectURL(file),
            note: "",
          };
        })
      );
      queue.push(...results);
    }
    renderQueue();
    $("btn-start-upload").disabled = queue.length === 0;

    const missing = queue.some((q) => !q.takenAt);
    if (missing && !$("upload-datetime").value) {
      $("upload-datetime").value = LefamiExif.toDatetimeLocalValue();
    }
  }

  function renderQueue() {
    const root = $("upload-queue");
    if (!root) return;
    if (!queue.length) {
      root.classList.add("hidden");
      root.innerHTML = "";
      return;
    }
    root.classList.remove("hidden");
    root.innerHTML = queue
      .map(
        (q, i) => `
      <div class="upload-queue__item" title="${escapeAttr(q.file.name)}">
        <img src="${q.previewUrl}" alt="" loading="lazy" />
        <span class="exif-badge">${
          q.takenAt ? LefamiExif.formatShort(q.takenAt) : "Chưa có EXIF"
        }</span>
        <button type="button" class="queue-remove" data-remove="${i}" aria-label="Xóa">×</button>
      </div>`
      )
      .join("");

    root.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const i = Number(btn.dataset.remove);
        if (queue[i]?.previewUrl) URL.revokeObjectURL(queue[i].previewUrl);
        queue.splice(i, 1);
        renderQueue();
        $("btn-start-upload").disabled = queue.length === 0;
      });
    });
  }

  function fillFamilies(families, selectedId) {
    const sel = $("upload-family");
    if (!sel) return;
    const options = families.filter((f) => f.id !== "all");
    sel.innerHTML = options
      .map(
        (f) =>
          `<option value="${f.id}" ${f.id === selectedId ? "selected" : ""}>${escapeHtml(f.name)}</option>`
      )
      .join("");
    if (!options.length) {
      sel.innerHTML = `<option value="">— Tạo gia đình trước —</option>`;
    }
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

  async function startUpload() {
    const familyId = $("upload-family").value;
    const familyName =
      $("upload-family").selectedOptions[0]?.textContent?.trim() || "";
    const note = $("upload-note").value.trim();
    const fallbackLocal = $("upload-datetime").value;
    const fallbackIso = fallbackLocal
      ? new Date(fallbackLocal).toISOString()
      : new Date().toISOString();

    if (!familyId) {
      $("upload-status").textContent = "Hãy tạo và chọn một gia đình trước.";
      return;
    }
    if (!queue.length) return;

    const btn = $("btn-start-upload");
    btn.disabled = true;
    const total = queue.length;
    let done = 0;

    try {
      for (const item of queue) {
        $("upload-status").textContent = `Đang tải ${done + 1}/${total}: ${item.file.name}`;
        const takenAt = item.takenAt || fallbackIso;
        await LefamiStorage.uploadPhoto(
          {
            file: item.file,
            familyId,
            familyName,
            note: item.note || note,
            takenAt,
          },
          () => {}
        );
        done += 1;
      }
      $("upload-status").textContent = `Đã tải lên ${total} ảnh.`;
      const cb = onUploadedCb;
      close();
      if (cb) await cb();
    } catch (err) {
      console.error(err);
      $("upload-status").textContent = err.message || "Upload lỗi.";
      btn.disabled = false;
    }
  }

  function bind(onUploaded) {
    onUploadedCb = onUploaded;
    const drop = $("dropzone");
    const input = $("file-input");
    const modal = $("upload-modal");

    $("btn-pick-files")?.addEventListener("click", (e) => {
      e.stopPropagation();
      input.click();
    });
    drop?.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      input.click();
    });
    input?.addEventListener("change", () => {
      if (input.files?.length) addFiles(input.files);
      input.value = "";
    });

    ["dragenter", "dragover"].forEach((ev) => {
      drop?.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.add("is-drag");
      });
    });
    ["dragleave", "drop"].forEach((ev) => {
      drop?.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.remove("is-drag");
      });
    });
    drop?.addEventListener("drop", (e) => {
      if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
    });

    $("btn-start-upload")?.addEventListener("click", () => startUpload());

    // Đóng chắc chắn: nút ×, Huỷ, click nền ngoài
    modal?.querySelectorAll("[data-close-upload]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        close();
      });
    });
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    modal?.addEventListener("cancel", (e) => {
      e.preventDefault();
      close();
    });
  }

  return { open, close, fillFamilies, bind, resetQueue };
})();
