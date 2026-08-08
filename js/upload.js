/** Upload queue — EXIF date, note, family, batch upload */
window.LefamiUpload = (() => {
  let queue = [];

  const $ = (id) => document.getElementById(id);

  function open() {
    $("upload-modal").showModal();
  }

  function close() {
    $("upload-modal").close();
  }

  function resetQueue() {
    queue.forEach((q) => {
      if (q.previewUrl) URL.revokeObjectURL(q.previewUrl);
    });
    queue = [];
    renderQueue();
    $("btn-start-upload").disabled = true;
    $("upload-status").textContent = "";
    $("upload-note").value = "";
  }

  async function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith("image/"));
    for (const file of files) {
      const takenAt = await LefamiExif.readTakenAt(file);
      queue.push({
        file,
        takenAt,
        previewUrl: URL.createObjectURL(file),
        note: "",
      });
    }
    renderQueue();
    $("btn-start-upload").disabled = queue.length === 0;

    // If all have EXIF, leave datetime empty hint; else set default now
    const missing = queue.some((q) => !q.takenAt);
    if (missing && !$("upload-datetime").value) {
      $("upload-datetime").value = LefamiExif.toDatetimeLocalValue();
    }
  }

  function renderQueue() {
    const root = $("upload-queue");
    if (!queue.length) {
      root.classList.add("hidden");
      root.innerHTML = "";
      return;
    }
    root.classList.remove("hidden");
    root.innerHTML = queue
      .map(
        (q, i) => `
      <div class="upload-queue__item" title="${q.file.name}">
        <img src="${q.previewUrl}" alt="" />
        <span class="exif-badge">${
          q.takenAt
            ? LefamiExif.formatShort(q.takenAt)
            : "Chưa có EXIF"
        }</span>
        <button type="button" class="btn-text" data-remove="${i}" style="position:absolute;top:0;right:0;background:rgba(0,0,0,.5);color:#fff;padding:0 .35rem;" aria-label="Xóa">×</button>
      </div>`
      )
      .join("");

    root.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
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

  async function startUpload(onDone) {
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
      resetQueue();
      close();
      if (onDone) await onDone();
    } catch (err) {
      console.error(err);
      $("upload-status").textContent = err.message || "Upload lỗi.";
      btn.disabled = false;
    }
  }

  function bind(onUploaded) {
    const drop = $("dropzone");
    const input = $("file-input");

    $("btn-pick-files").addEventListener("click", () => input.click());
    drop.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      input.click();
    });
    input.addEventListener("change", () => {
      if (input.files?.length) addFiles(input.files);
      input.value = "";
    });

    ["dragenter", "dragover"].forEach((ev) => {
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.add("is-drag");
      });
    });
    ["dragleave", "drop"].forEach((ev) => {
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.remove("is-drag");
      });
    });
    drop.addEventListener("drop", (e) => {
      if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
    });

    $("btn-start-upload").addEventListener("click", () => startUpload(onUploaded));

    $("upload-form").addEventListener("submit", (e) => {
      // closing via cancel
      if (e.submitter?.value === "cancel") {
        resetQueue();
      }
    });
  }

  return { open, close, fillFamilies, bind, resetQueue };
})();
