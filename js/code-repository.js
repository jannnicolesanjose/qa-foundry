(function () {
  const $ = (s) => document.querySelector(s);
  const LANG_COLORS = {
    JavaScript: "#E8C069", TypeScript: "#7FB3D9", Python: "#8FB89A", Java: "#DC8983",
    "C#": "#B0A0DC", "Robot Framework": "#6FB8A8", Gherkin: "#9CA3AF", JSON: "#E8A6A0",
    YAML: "#B0A0DC", Other: "#9CA3AF",
  };
  const FOLDER_COLORS = [
    { name: "Foundry Red", value: "#E8A6A0" },
    { name: "Amber", value: "#E8B86A" },
    { name: "Sage", value: "#8FB89A" },
    { name: "Sky", value: "#8FB4D9" },
    { name: "Violet", value: "#B0A0DC" },
    { name: "Slate", value: "#9CA3AF" },
  ];

  let codeFiles = [];
  let repoFolders = [];
  let currentFolderId = null;
  let activeFileId = null;
  let dirty = false;
  let selectedFolderColor = FOLDER_COLORS[0].value;

  // ---------- Folders ----------
  async function refreshFolders() {
    repoFolders = await QAFDB.getAll("codeFolders");
    renderBreadcrumb();
    renderFolderGrid();
  }

  function renderBreadcrumb() {
    const bc = $("#repo-breadcrumb");
    bc.innerHTML = `<button data-nav="root">All Files</button>`;
    if (currentFolderId) {
      const f = repoFolders.find((x) => x.id === currentFolderId);
      if (f) bc.innerHTML += ` <span>/</span> <span style="color:var(--text-primary); font-weight:600;">${escapeHtml(f.name)}</span>`;
    }
    bc.querySelector('[data-nav="root"]').addEventListener("click", () => { currentFolderId = null; refreshFolders(); refreshTree(); });
  }

  function renderFolderGrid() {
    const grid = $("#repo-folder-grid");
    if (currentFolderId) { grid.innerHTML = ""; grid.classList.add("hidden"); return; }
    grid.classList.remove("hidden");
    if (repoFolders.length === 0) { grid.innerHTML = ""; return; }
    grid.innerHTML = repoFolders.map((f) => {
      const count = codeFiles.filter((x) => x.folderId === f.id).length;
      return `
      <div class="repo-folder-card" data-id="${f.id}">
        <button class="icon-btn repo-folder-menu" data-menu="${f.id}" style="width:22px; height:22px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
        </button>
        <div class="repo-folder-icon" style="background:${f.color}"></div>
        <div class="repo-folder-name">${escapeHtml(f.name)}</div>
        <div class="repo-folder-count">${count} file${count === 1 ? "" : "s"}</div>
      </div>`;
    }).join("");
    grid.querySelectorAll(".repo-folder-card").forEach((card) => card.addEventListener("click", (e) => {
      if (e.target.closest("[data-menu]")) return;
      currentFolderId = card.dataset.id;
      refreshFolders();
      refreshTree();
    }));
    grid.querySelectorAll("[data-menu]").forEach((btn) => btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm("Delete this folder? Files inside will move to All Files.")) {
        await QAFDB.delete("codeFolders", btn.dataset.menu);
        const inside = codeFiles.filter((f) => f.folderId === btn.dataset.menu);
        for (const f of inside) { f.folderId = null; await QAFDB.put("codeFiles", f); }
        QAFToast.success("Folder deleted. Files kept in All Files.");
        await refreshFolders();
        refreshTree();
      }
    }));
  }

  function renderFolderColorSwatches() {
    $("#repo-folder-colors").innerHTML = FOLDER_COLORS.map((c) =>
      `<div class="swatch ${c.value === selectedFolderColor ? "selected" : ""}" style="background:${c.value}" data-color="${c.value}" title="${c.name}"></div>`
    ).join("");
    $("#repo-folder-colors").querySelectorAll(".swatch").forEach((s) => {
      s.addEventListener("click", () => { selectedFolderColor = s.dataset.color; renderFolderColorSwatches(); });
    });
  }

  $("#btn-new-folder").addEventListener("click", () => {
    $("#input-repo-folder-name").value = "";
    selectedFolderColor = FOLDER_COLORS[0].value;
    QAFValidate.clearFieldError($("#field-repo-folder-name"));
    renderFolderColorSwatches();
    $("#modal-new-folder").hidden = false;
  });

  $("#save-repo-folder").addEventListener("click", async () => {
    const name = $("#input-repo-folder-name").value.trim();
    const err = QAFValidate.requireText(name, "Folder name");
    if (err) { QAFValidate.setFieldError($("#field-repo-folder-name"), err); return; }
    if (repoFolders.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      QAFValidate.setFieldError($("#field-repo-folder-name"), "A folder with that name already exists.");
      return;
    }
    await QAFDB.put("codeFolders", { id: QAFDB.uid(), name, color: selectedFolderColor, createdAt: Date.now() });
    QAFToast.success(`Folder "${name}" created.`);
    $("#modal-new-folder").hidden = true;
    await refreshFolders();
  });

  // ---------- Files ----------
  async function refreshTree() {
    codeFiles = await QAFDB.getAll("codeFiles");
    const search = ($("#repo-search").value || "").toLowerCase();
    let list = currentFolderId ? codeFiles.filter((f) => f.folderId === currentFolderId) : codeFiles;
    list = list.filter((f) => f.name.toLowerCase().includes(search)).sort((a, b) => b.updatedAt - a.updatedAt);
    const tree = $("#file-tree");
    if (list.length === 0) {
      tree.innerHTML = `<p class="text-dim" style="font-size:12.5px; padding:8px;">No files here yet.</p>`;
    } else {
      tree.innerHTML = list.map((f) => `
        <div class="tree-item ${f.id === activeFileId ? "active" : ""}" data-id="${f.id}">
          <span class="lang-dot" style="background:${LANG_COLORS[f.language] || "#9CA3AF"}"></span>
          <span class="t-name">${escapeHtml(f.name)}</span>
          <span class="t-ver">v${f.versionCount || 1}</span>
        </div>`).join("");
      tree.querySelectorAll(".tree-item").forEach((el) => el.addEventListener("click", () => openFile(el.dataset.id)));
    }
    renderFolderGrid();
  }

  async function openFile(id) {
    if (dirty && !confirm("You have unsaved edits. Discard them and switch files?")) return;
    activeFileId = id;
    dirty = false;
    const file = codeFiles.find((f) => f.id === id) || (await QAFDB.get("codeFiles", id));
    const versions = (await QAFDB.getAll("codeVersions")).filter((v) => v.codeFileId === id).sort((a, b) => b.versionNumber - a.versionNumber);
    const latest = versions[0];

    $("#no-file-selected").classList.add("hidden");
    $("#file-editor-wrap").classList.remove("hidden");
    $("#editing-filename").textContent = file.name;
    $("#editing-lang").textContent = file.language;
    $("#editing-meta").innerHTML = `<span>Created ${QAFValidate.fmtDate(file.createdAt)}</span><span class="dot-sep">${versions.length} version${versions.length === 1 ? "" : "s"}</span>`;
    $("#code-editor").value = latest ? latest.content : "";
    $("#code-editor").dataset.baseline = $("#code-editor").value;

    renderVersions(versions);
    renderDiffSelectors(versions);
    refreshTree();
  }

  function renderVersions(versions) {
    const wrap = $("#version-list");
    if (versions.length === 0) { wrap.innerHTML = `<p class="text-dim" style="font-size:12.5px;">No versions saved yet.</p>`; return; }
    wrap.innerHTML = versions.map((v) => `
      <div class="version-row">
        <span class="v-badge">v${v.versionNumber}</span>
        <span class="v-msg">${escapeHtml(v.message || "No message")}</span>
        <span class="v-meta">${escapeHtml(v.author || "Unknown")} · ${QAFValidate.fmtDate(v.timestamp)}</span>
        <button class="icon-btn" data-restore="${v.id}" title="Restore this version">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        </button>
      </div>`).join("");
    wrap.querySelectorAll("[data-restore]").forEach((b) => b.addEventListener("click", async () => {
      const v = versions.find((x) => x.id === b.dataset.restore);
      if (!v) return;
      if (!confirm(`Restore v${v.versionNumber} into the editor? You can save it as a new version.`)) return;
      $("#code-editor").value = v.content;
      dirty = true;
      QAFToast.info(`v${v.versionNumber} loaded into the editor. Save it to create a new version.`);
    }));
  }

  function renderDiffSelectors(versions) {
    const opts = versions.map((v) => `<option value="${v.id}">v${v.versionNumber} — ${QAFValidate.fmtDate(v.timestamp)}</option>`).join("");
    $("#diff-from").innerHTML = opts;
    $("#diff-to").innerHTML = opts;
    if (versions.length > 1) { $("#diff-from").selectedIndex = 1; $("#diff-to").selectedIndex = 0; }
    $("#diff-output").innerHTML = `<p class="text-dim" style="font-size:12.5px;">Pick two versions and press Compare.</p>`;
  }

  // ---------- Simple LCS-based line diff ----------
  function diffLines(a, b) {
    const la = a.split("\n"), lb = b.split("\n");
    const n = la.length, m = lb.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = la[i] === lb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const out = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (la[i] === lb[j]) { out.push({ type: "ctx", text: la[i] }); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: "rm", text: la[i] }); i++; }
      else { out.push({ type: "add", text: lb[j] }); j++; }
    }
    while (i < n) { out.push({ type: "rm", text: la[i] }); i++; }
    while (j < m) { out.push({ type: "add", text: lb[j] }); j++; }
    return out;
  }

  $("#btn-run-diff").addEventListener("click", async () => {
    const fromId = $("#diff-from").value, toId = $("#diff-to").value;
    const versions = await QAFDB.getAll("codeVersions");
    const from = versions.find((v) => v.id === fromId);
    const to = versions.find((v) => v.id === toId);
    if (!from || !to) return;
    const lines = diffLines(from.content, to.content);
    const changed = lines.filter((l) => l.type !== "ctx").length;
    $("#diff-output").innerHTML =
      `<div class="meta-row" style="margin-bottom:10px;">Comparing v${from.versionNumber} → v${to.versionNumber} · ${changed} changed line${changed === 1 ? "" : "s"}</div>` +
      lines.map((l) => {
        const cls = l.type === "add" ? "diff-add" : l.type === "rm" ? "diff-remove" : "diff-context";
        const prefix = l.type === "add" ? "+ " : l.type === "rm" ? "- " : "  ";
        return `<div class="diff-line ${cls}">${prefix}${escapeHtml(l.text)}</div>`;
      }).join("");
  });

  // ---------- New file ----------
  $("#btn-new-file").addEventListener("click", () => {
    $("#input-file-name").value = "";
    $("#input-file-author").value = localStorage.getItem("qaf-author") || "";
    QAFValidate.clearFieldError($("#field-file-name"));
    const sel = $("#input-file-folder");
    sel.innerHTML = `<option value="">— None (All Files) —</option>` +
      repoFolders.map((f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join("");
    if (currentFolderId) sel.value = currentFolderId;
    $("#modal-new-file").hidden = false;
  });

  $("#save-new-file").addEventListener("click", async () => {
    const name = $("#input-file-name").value.trim();
    const err = QAFValidate.requireText(name, "File name");
    if (err) { QAFValidate.setFieldError($("#field-file-name"), err); return; }
    if (codeFiles.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      QAFValidate.setFieldError($("#field-file-name"), "A file with that name already exists.");
      return;
    }
    const lang = $("#input-file-lang").value;
    const author = $("#input-file-author").value.trim() || "Unknown";
    const folderId = $("#input-file-folder").value || null;
    localStorage.setItem("qaf-author", author);
    const now = Date.now();
    const fileId = QAFDB.uid();
    await QAFDB.put("codeFiles", { id: fileId, name, language: lang, folderId, createdAt: now, updatedAt: now, versionCount: 1 });
    await QAFDB.put("codeVersions", {
      id: QAFDB.uid(), codeFileId: fileId, versionNumber: 1,
      content: "", message: "Initial version", author, timestamp: now,
    });
    QAFToast.success(`"${name}" created.`);
    $("#modal-new-file").hidden = true;
    await refreshTree();
    openFile(fileId);
  });

  // ---------- Save new version ----------
  $("#btn-save-version").addEventListener("click", () => {
    $("#input-commit-msg").value = "";
    $("#input-commit-author").value = localStorage.getItem("qaf-author") || "";
    QAFValidate.clearFieldError($("#field-commit-msg"));
    $("#modal-commit").hidden = false;
  });

  $("#confirm-commit").addEventListener("click", async () => {
    const msg = $("#input-commit-msg").value.trim();
    const err = QAFValidate.requireText(msg, "A short commit message");
    if (err) { QAFValidate.setFieldError($("#field-commit-msg"), err); return; }
    const author = $("#input-commit-author").value.trim() || "Unknown";
    localStorage.setItem("qaf-author", author);

    const file = codeFiles.find((f) => f.id === activeFileId);
    const versions = (await QAFDB.getAll("codeVersions")).filter((v) => v.codeFileId === activeFileId);
    const nextVer = versions.length + 1;
    const now = Date.now();
    await QAFDB.put("codeVersions", {
      id: QAFDB.uid(), codeFileId: activeFileId, versionNumber: nextVer,
      content: $("#code-editor").value, message: msg, author, timestamp: now,
    });
    file.updatedAt = now; file.versionCount = nextVer;
    await QAFDB.put("codeFiles", file);
    dirty = false;
    QAFToast.success(`Saved as v${nextVer}.`);
    $("#modal-commit").hidden = true;
    openFile(activeFileId);
  });

  $("#btn-delete-file").addEventListener("click", async () => {
    const file = codeFiles.find((f) => f.id === activeFileId);
    if (!file) return;
    if (!confirm(`Delete "${file.name}" and all its version history? This can't be undone.`)) return;
    await QAFDB.delete("codeFiles", activeFileId);
    await QAFDB.deleteWhere("codeVersions", (v) => v.codeFileId === activeFileId);
    activeFileId = null;
    $("#file-editor-wrap").classList.add("hidden");
    $("#no-file-selected").classList.remove("hidden");
    QAFToast.success("File deleted.");
    refreshTree();
  });

  $("#code-editor").addEventListener("input", () => { dirty = $("#code-editor").value !== $("#code-editor").dataset.baseline; });

  document.querySelectorAll(".tab-btn").forEach((btn) => btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    ["code", "history", "diff"].forEach((t) => $("#tab-" + t).classList.toggle("hidden", t !== btn.dataset.tab));
  }));

  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", (e) => {
    e.target.closest(".modal-overlay").hidden = true;
  }));

  $("#repo-search").addEventListener("input", refreshTree);

  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  (async function init() {
    await refreshFolders();
    await refreshTree();
  })();
})();
