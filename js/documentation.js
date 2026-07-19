(function () {
  const FOLDER_COLORS = [
    { name: "Foundry Red", value: "#E8A6A0" },
    { name: "Amber", value: "#E8B86A" },
    { name: "Sage", value: "#8FB89A" },
    { name: "Sky", value: "#8FB4D9" },
    { name: "Violet", value: "#B0A0DC" },
    { name: "Slate", value: "#9CA3AF" },
  ];

  let currentFolderId = null; // null = root
  let pendingFile = null;
  let folders = [];
  let files = [];

  const $ = (sel) => document.querySelector(sel);
  const folderGrid = $("#folder-grid");
  const fileList = $("#file-list");
  const breadcrumb = $("#breadcrumb");
  const emptyState = $("#doc-empty");

  async function refresh() {
    [folders, files] = await Promise.all([QAFDB.getAll("folders"), QAFDB.getAll("files")]);
    renderBreadcrumb();
    renderFolders();
    renderFiles();
  }

  function renderBreadcrumb() {
    breadcrumb.innerHTML = `<button data-nav="root">All Documents</button>`;
    if (currentFolderId) {
      const f = folders.find((x) => x.id === currentFolderId);
      if (f) breadcrumb.innerHTML += ` <span>/</span> <span style="color:var(--text-primary); font-weight:600;">${escapeHtml(f.name)}</span>`;
    }
    breadcrumb.querySelector('[data-nav="root"]').onclick = () => { currentFolderId = null; refresh(); };
  }

  function renderFolders() {
    if (currentFolderId) { folderGrid.classList.add("hidden"); return; }
    folderGrid.classList.remove("hidden");
    if (folders.length === 0) { folderGrid.innerHTML = ""; return; }
    folderGrid.innerHTML = folders.map((f) => {
      const count = files.filter((x) => x.folderId === f.id).length;
      return `
      <div class="folder-card" data-id="${f.id}">
        <button class="icon-btn folder-menu-btn" data-menu="${f.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
        </button>
        <div class="folder-icon-wrap" style="background:${f.color}"></div>
        <div class="folder-name">${escapeHtml(f.name)}</div>
        <div class="folder-count">${count} file${count === 1 ? "" : "s"}</div>
      </div>`;
    }).join("");

    folderGrid.querySelectorAll(".folder-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-menu]")) return;
        currentFolderId = card.dataset.id;
        refresh();
      });
    });
    folderGrid.querySelectorAll("[data-menu]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("Delete this folder? Files inside will move to All Documents.")) {
          deleteFolder(btn.dataset.menu);
        }
      });
    });
  }

  async function deleteFolder(id) {
    await QAFDB.delete("folders", id);
    const inside = files.filter((f) => f.folderId === id);
    for (const f of inside) { f.folderId = null; await QAFDB.put("files", f); }
    QAFToast.success("Folder deleted. Files kept in All Documents.");
    refresh();
  }

  function renderFiles() {
    const search = ($("#doc-search").value || "").toLowerCase();
    let scoped = currentFolderId ? files.filter((f) => f.folderId === currentFolderId) : files;
    if (search) scoped = scoped.filter((f) => f.name.toLowerCase().includes(search));
    scoped = scoped.slice().sort((a, b) => b.uploadedAt - a.uploadedAt);

    if (scoped.length === 0) {
      fileList.innerHTML = "";
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    fileList.innerHTML = scoped.map((f) => `
      <div class="file-row" data-id="${f.id}">
        <div class="file-ico">${(QAFValidate.extOf(f.name).replace(".", "") || "DOC").toUpperCase()}</div>
        <div class="file-info">
          <div class="file-name">${escapeHtml(f.name)}</div>
          <div class="file-meta">${QAFValidate.fmtBytes(f.size)} · ${f.source === "created" ? "Created" : "Uploaded"} ${QAFValidate.fmtDate(f.uploadedAt)}</div>
        </div>
        <div class="file-actions">
          ${f.source === "created" ? `<button class="icon-btn" data-edit="${f.id}" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>` : ""}
          <button class="icon-btn" data-dl="${f.id}" title="Download">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button class="icon-btn" data-del="${f.id}" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>`).join("");

    fileList.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => downloadFile(b.dataset.dl)));
    fileList.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openCreateDocModal(b.dataset.edit)));
    fileList.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
      if (confirm("Delete this file? This can't be undone.")) removeFile(b.dataset.del);
    }));
  }

  async function downloadFile(id) {
    const f = files.find((x) => x.id === id);
    if (!f) return;
    const url = URL.createObjectURL(f.blob);
    const a = document.createElement("a");
    a.href = url; a.download = f.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function removeFile(id) {
    await QAFDB.delete("files", id);
    QAFToast.success("File deleted.");
    refresh();
  }

  // ---------- New folder modal ----------
  const modalFolder = $("#modal-folder");
  let selectedColor = FOLDER_COLORS[0].value;
  function renderColorSwatches() {
    $("#folder-colors").innerHTML = FOLDER_COLORS.map((c) =>
      `<div class="swatch ${c.value === selectedColor ? "selected" : ""}" style="background:${c.value}" data-color="${c.value}" title="${c.name}"></div>`
    ).join("");
    $("#folder-colors").querySelectorAll(".swatch").forEach((s) => {
      s.addEventListener("click", () => { selectedColor = s.dataset.color; renderColorSwatches(); });
    });
  }

  $("#btn-new-folder").addEventListener("click", () => {
    $("#input-folder-name").value = "";
    QAFValidate.clearFieldError($("#field-folder-name"));
    renderColorSwatches();
    modalFolder.hidden = false;
  });

  $("#save-folder").addEventListener("click", async () => {
    const name = $("#input-folder-name").value.trim();
    const err = QAFValidate.requireText(name, "Folder name");
    if (err) { QAFValidate.setFieldError($("#field-folder-name"), err); return; }
    if (folders.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      QAFValidate.setFieldError($("#field-folder-name"), "A folder with that name already exists.");
      return;
    }
    await QAFDB.put("folders", { id: QAFDB.uid(), name, color: selectedColor, createdAt: Date.now() });
    QAFToast.success(`Folder "${name}" created.`);
    modalFolder.hidden = true;
    refresh();
  });

  // ---------- Upload modal ----------
  const modalUpload = $("#modal-upload");
  const dz = $("#upload-dropzone");
  const fileInput = $("#file-input");

  $("#btn-upload").addEventListener("click", () => {
    pendingFile = null;
    $("#selected-file-info").textContent = "";
    $("#confirm-upload").disabled = true;
    const sel = $("#upload-folder-select");
    sel.innerHTML = `<option value="">— None (All Documents) —</option>` +
      folders.map((f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join("");
    if (currentFolderId) sel.value = currentFolderId;
    modalUpload.hidden = false;
  });

  dz.addEventListener("click", () => fileInput.click());
  dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("drag-over"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag-over"));
  dz.addEventListener("drop", (e) => {
    e.preventDefault(); dz.classList.remove("drag-over");
    if (e.dataTransfer.files[0]) handleFileChosen(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener("change", () => { if (fileInput.files[0]) handleFileChosen(fileInput.files[0]); });

  function handleFileChosen(file) {
    const errors = QAFValidate.validateFile(file, { allowedExt: QAFValidate.DOC_EXT, maxSizeMB: 20 });
    if (errors.length) {
      QAFToast.error(errors[0], "Invalid file");
      pendingFile = null;
      $("#confirm-upload").disabled = true;
      $("#selected-file-info").textContent = "";
      return;
    }
    pendingFile = file;
    $("#selected-file-info").textContent = `Selected: ${file.name} (${QAFValidate.fmtBytes(file.size)})`;
    $("#confirm-upload").disabled = false;
  }

  $("#confirm-upload").addEventListener("click", async () => {
    if (!pendingFile) return;
    const folderId = $("#upload-folder-select").value || null;
    await QAFDB.put("files", {
      id: QAFDB.uid(),
      name: pendingFile.name,
      size: pendingFile.size,
      mime: pendingFile.type,
      blob: pendingFile,
      folderId,
      uploadedAt: Date.now(),
    });
    QAFToast.success(`"${pendingFile.name}" uploaded.`);
    modalUpload.hidden = true;
    pendingFile = null;
    refresh();
  });

  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", (e) => {
    e.target.closest(".modal-overlay").hidden = true;
  }));

  $("#doc-search").addEventListener("input", renderFiles);

  // ---------- Create / edit in-app document ----------
  const modalCreateDoc = $("#modal-create-doc");
  let editingDocId = null;

  function autoGrow(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  function bodyBulletKeydown(ev) {
    if (ev.key !== "Enter" || ev.shiftKey) return;
    ev.preventDefault();
    const el = ev.target;
    const start = el.selectionStart, end = el.selectionEnd;
    const before = el.value.slice(0, start), after = el.value.slice(end);
    const insertion = "\n• ";
    el.value = before + insertion + after;
    const pos = start + insertion.length;
    el.selectionStart = el.selectionEnd = pos;
    autoGrow(el);
  }
  $("#input-doc-body").addEventListener("keydown", bodyBulletKeydown);
  $("#input-doc-body").addEventListener("input", (e) => autoGrow(e.target));

  function bulletHtmlFromText(text) {
    const lines = (text || "").split(/\n+/).map((l) => l.replace(/^•\s*/, "").trim()).filter(Boolean);
    if (lines.length === 0) return "";
    if (lines.length === 1) return `<p>${escapeHtml(lines[0])}</p>`;
    return `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`;
  }

  function buildDocBlob(title, bodyText) {
    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
      <style>
        body { font-family: Calibri, Arial, sans-serif; }
        h1 { color: #B14E47; font-size: 20px; }
        ul { margin: 0 0 8px; padding-left: 18px; }
        p { margin: 0 0 8px; }
      </style></head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        ${bulletHtmlFromText(bodyText)}
      </body></html>`;
    return new Blob(["\ufeff", html], { type: "application/msword" });
  }

  function openCreateDocModal(fileId) {
    editingDocId = fileId || null;
    QAFValidate.clearFieldError($("#field-doc-title"));
    const sel = $("#doc-folder-select");
    sel.innerHTML = `<option value="">— None (All Documents) —</option>` +
      folders.map((f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join("");

    if (editingDocId) {
      const f = files.find((x) => x.id === editingDocId);
      $("#create-doc-title").textContent = "Edit document";
      $("#input-doc-title").value = f.title || f.name.replace(/\.doc$/i, "");
      $("#input-doc-body").value = f.bodyText || "";
      sel.value = f.folderId || "";
    } else {
      $("#create-doc-title").textContent = "Create document";
      $("#input-doc-title").value = "";
      $("#input-doc-body").value = "";
      if (currentFolderId) sel.value = currentFolderId;
    }
    modalCreateDoc.hidden = false;
    setTimeout(() => autoGrow($("#input-doc-body")), 0);
  }

  $("#btn-create-doc").addEventListener("click", () => openCreateDocModal(null));

  $("#save-create-doc").addEventListener("click", async () => {
    const title = $("#input-doc-title").value.trim();
    const err = QAFValidate.requireText(title, "Title");
    if (err) { QAFValidate.setFieldError($("#field-doc-title"), err); return; }
    const bodyText = $("#input-doc-body").value;
    const folderId = $("#doc-folder-select").value || null;
    const blob = buildDocBlob(title, bodyText);
    const fileName = `${title}.doc`;

    if (editingDocId) {
      const f = files.find((x) => x.id === editingDocId);
      f.name = fileName; f.title = title; f.bodyText = bodyText; f.folderId = folderId;
      f.blob = blob; f.size = blob.size; f.mime = blob.type; f.uploadedAt = Date.now();
      await QAFDB.put("files", f);
      QAFToast.success("Document updated.");
    } else {
      await QAFDB.put("files", {
        id: QAFDB.uid(), name: fileName, title, bodyText, source: "created",
        size: blob.size, mime: blob.type, blob, folderId, uploadedAt: Date.now(),
      });
      QAFToast.success(`"${title}" created.`);
    }
    modalCreateDoc.hidden = true;
    editingDocId = null;
    refresh();
  });

  refresh();
})();
