(function () {
  const $ = (s) => document.querySelector(s);

  const UNIT_TEMPLATE = `// Example: testing a pure function in isolation.
// Paste or write the code you want to test, then add
// describe/it blocks below it — everything runs together.

function calculateDiscount(total, coupon) {
  if (coupon === "SAVE10") return total * 0.9;
  if (coupon === "SAVE20") return total * 0.8;
  return total;
}

describe("calculateDiscount", () => {
  it("applies a 10% discount for SAVE10", () => {
    expect(calculateDiscount(100, "SAVE10")).toBe(90);
  });

  it("applies a 20% discount for SAVE20", () => {
    expect(calculateDiscount(100, "SAVE20")).toBe(80);
  });

  it("returns the original total for an unrecognized coupon", () => {
    expect(calculateDiscount(100, "NOPE")).toBe(100);
  });

  it("handles a zero total", () => {
    expect(calculateDiscount(0, "SAVE10")).toBe(0);
  });
});
`;

  const INTEGRATION_TEMPLATE = `// Example: an integration test that calls a real API end to end.
// Swap the URL for one of your own endpoints. The target API
// must allow cross-origin (CORS) requests from the browser,
// same requirement as the API Tester page.

describe("Users API", () => {
  it("returns a 200 for a valid request", async () => {
    const res = await fetch("https://jsonplaceholder.typicode.com/users/1");
    expect(res.status).toBe(200);
  });

  it("returns a user with an email field", async () => {
    const res = await fetch("https://jsonplaceholder.typicode.com/users/1");
    const data = await res.json();
    expect(data.email).toBeTruthy();
  });

  it("returns 404 for a non-existent user", async () => {
    const res = await fetch("https://jsonplaceholder.typicode.com/users/999999");
    expect(res.status).toBe(404);
  });
});
`;

  let suites = [];
  let activeId = null;
  let activeFilter = "all";

  async function refresh() {
    suites = await QAFDB.getAll("testSuites");
    renderList();
  }

  function renderList() {
    const search = ($("#tr-search").value || "").toLowerCase();
    let list = suites.slice().sort((a, b) => b.updatedAt - a.updatedAt);
    if (activeFilter !== "all") list = list.filter((s) => s.type === activeFilter);
    if (search) list = list.filter((s) => s.name.toLowerCase().includes(search));

    const el = $("#suite-list");
    if (list.length === 0) {
      el.innerHTML = `<p class="text-dim" style="font-size:12.5px; padding:8px;">No suites yet. Create one to get started.</p>`;
      return;
    }
    el.innerHTML = list.map((s) => {
      const dot = !s.lastRun ? "run-none" : s.lastRun.summary.failed > 0 ? "run-fail" : "run-pass";
      return `
      <div class="suite-item ${s.id === activeId ? "active" : ""}" data-id="${s.id}">
        <span class="run-dot ${dot}"></span>
        <span class="si-name">${escapeHtml(s.name)}</span>
        <span class="type-tag type-${s.type}">${s.type}</span>
      </div>`;
    }).join("");
    el.querySelectorAll(".suite-item").forEach((item) => item.addEventListener("click", () => openSuite(item.dataset.id)));
  }

  function openSuite(id) {
    activeId = id;
    const s = suites.find((x) => x.id === id);
    if (!s) return;
    $("#no-suite-selected").classList.add("hidden");
    $("#suite-editor-wrap").classList.remove("hidden");
    $("#editing-suite-name").textContent = s.name;
    $("#editing-suite-type").textContent = s.type;
    $("#editing-suite-meta").innerHTML = `<span>Updated ${QAFValidate.timeAgo(s.updatedAt)}</span>` +
      (s.lastRun ? `<span class="dot-sep">Last run: ${s.lastRun.summary.passed}/${s.lastRun.summary.total} passed</span>` : `<span class="dot-sep">Never run</span>`);
    $("#suite-code").value = s.code;
    $("#run-output").classList.add("hidden");
    renderList();
  }

  $("#btn-new-suite").addEventListener("click", () => {
    $("#input-suite-name").value = "";
    $("#input-suite-type").value = "unit";
    QAFValidate.clearFieldError($("#field-suite-name"));
    $("#modal-new-suite").hidden = false;
  });

  $("#save-new-suite").addEventListener("click", async () => {
    const name = $("#input-suite-name").value.trim();
    const err = QAFValidate.requireText(name, "Suite name");
    if (err) { QAFValidate.setFieldError($("#field-suite-name"), err); return; }
    const type = $("#input-suite-type").value;
    const now = Date.now();
    const suite = {
      id: QAFDB.uid(), name, type,
      code: type === "unit" ? UNIT_TEMPLATE : INTEGRATION_TEMPLATE,
      createdAt: now, updatedAt: now, lastRun: null,
    };
    await QAFDB.put("testSuites", suite);
    QAFToast.success(`"${name}" created.`);
    $("#modal-new-suite").hidden = true;
    await refresh();
    openSuite(suite.id);
  });

  $("#btn-load-template").addEventListener("click", () => {
    const s = suites.find((x) => x.id === activeId);
    if (!s) return;
    if (!confirm("Replace the current code with the starter template? Unsaved edits will be lost.")) return;
    $("#suite-code").value = s.type === "unit" ? UNIT_TEMPLATE : INTEGRATION_TEMPLATE;
  });

  $("#btn-save-suite").addEventListener("click", async () => {
    const s = suites.find((x) => x.id === activeId);
    if (!s) return;
    s.code = $("#suite-code").value;
    s.updatedAt = Date.now();
    await QAFDB.put("testSuites", s);
    QAFToast.success("Suite saved.");
    await refresh();
    openSuite(activeId);
  });

  $("#btn-delete-suite").addEventListener("click", async () => {
    const s = suites.find((x) => x.id === activeId);
    if (!s) return;
    if (!confirm(`Delete "${s.name}"? This can't be undone.`)) return;
    await QAFDB.delete("testSuites", activeId);
    activeId = null;
    $("#suite-editor-wrap").classList.add("hidden");
    $("#no-suite-selected").classList.remove("hidden");
    QAFToast.success("Suite deleted.");
    refresh();
  });

  $("#btn-run-suite").addEventListener("click", async () => {
    const s = suites.find((x) => x.id === activeId);
    if (!s) return;
    const btn = $("#btn-run-suite");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Running…`;
    const code = $("#suite-code").value;

    let outcome;
    try {
      outcome = await QAFTestEngine.runSuite(code);
    } catch (e) {
      outcome = { results: [], errors: [e.message], summary: { total: 0, passed: 0, failed: 0, skipped: 0 } };
    }
    renderResults(outcome);

    s.code = code;
    s.updatedAt = Date.now();
    s.lastRun = { summary: outcome.summary, timestamp: Date.now() };
    await QAFDB.put("testSuites", s);
    await refresh();
    activeId = s.id;
    renderList();

    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run`;
  });

  function renderResults({ results, errors, summary }) {
    $("#run-output").classList.remove("hidden");
    $("#summary-bar").innerHTML = `
      <span class="summary-chip">${summary.total} test${summary.total === 1 ? "" : "s"}</span>
      <span class="summary-chip chip-pass">${summary.passed} passed</span>
      <span class="summary-chip ${summary.failed ? "chip-fail" : ""}">${summary.failed} failed</span>
      <span class="summary-chip chip-skip">${summary.skipped} skipped</span>
    `;
    $("#run-errors").innerHTML = errors.length
      ? `<div class="result-row r-fail"><div class="r-body"><div class="r-name">Suite error</div><div class="r-err">${errors.map(escapeHtml).join("\n")}</div></div></div>`
      : "";
    $("#result-list").innerHTML = results.map((r) => {
      const cls = r.status === "pass" ? "r-pass" : r.status === "fail" ? "r-fail" : "";
      const icon = r.status === "pass"
        ? `<svg class="r-icon" viewBox="0 0 24 24" fill="none" stroke="#4E8C64" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
        : r.status === "fail"
        ? `<svg class="r-icon" viewBox="0 0 24 24" fill="none" stroke="var(--red-500)" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
        : `<svg class="r-icon" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2.5"><circle cx="12" cy="12" r="9"/></svg>`;
      return `
      <div class="result-row ${cls}">
        ${icon}
        <div class="r-body">
          <div class="r-name">${escapeHtml(r.name)}</div>
          ${r.error ? `<div class="r-err">${escapeHtml(r.error)}</div>` : ""}
        </div>
        ${r.duration !== undefined ? `<span class="r-time">${r.duration.toFixed(1)}ms</span>` : ""}
      </div>`;
    }).join("");

    if (summary.failed === 0 && summary.total > 0 && errors.length === 0) {
      QAFToast.success(`All ${summary.total} tests passed.`);
    } else if (summary.failed > 0) {
      QAFToast.error(`${summary.failed} of ${summary.total} tests failed.`, "Run complete");
    } else if (errors.length) {
      QAFToast.error("The suite couldn't run — check the error above.", "Script error");
    }
  }

  document.querySelectorAll('[data-filter]').forEach((btn) => btn.addEventListener("click", () => {
    document.querySelectorAll('[data-filter]').forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter;
    renderList();
  }));

  $("#tr-search").addEventListener("input", renderList);
  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", (e) => {
    e.target.closest(".modal-overlay").hidden = true;
  }));

  // ---------- Import code (Code Repository or local file) ----------
  function insertAtCursor(text) {
    const el = $("#suite-code");
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start), after = el.value.slice(end);
    const needsNewline = before.length && !before.endsWith("\n");
    const insertion = (needsNewline ? "\n" : "") + text;
    el.value = before + insertion + after;
    const pos = start + insertion.length;
    el.focus();
    el.selectionStart = el.selectionEnd = pos;
  }

  $("#btn-import-repo").addEventListener("click", async () => {
    if (!activeId) { QAFToast.error("Open or create a suite first.", "No suite open"); return; }
    const files = await QAFDB.getAll("codeFiles");
    const versions = await QAFDB.getAll("codeVersions");
    const list = $("#import-repo-list");
    if (files.length === 0) {
      list.innerHTML = `<p class="text-dim" style="font-size:12.5px;">No files saved in the Code Repository yet.</p>`;
    } else {
      list.innerHTML = files.map((f) => `
        <div class="import-item" data-id="${f.id}">
          <span class="si-name">${escapeHtml(f.name)}</span>
          <span class="type-tag type-unit">${escapeHtml(f.language || "")}</span>
        </div>`).join("");
      list.querySelectorAll(".import-item").forEach((item) => item.addEventListener("click", () => {
        const fileVersions = versions.filter((x) => x.codeFileId === item.dataset.id).sort((a, b) => b.versionNumber - a.versionNumber);
        const latest = fileVersions[0];
        if (latest) {
          insertAtCursor(latest.content);
          QAFToast.success("Inserted into the editor.");
        } else {
          QAFToast.error("That file has no saved content yet.");
        }
        $("#modal-import-repo").hidden = true;
      }));
    }
    $("#modal-import-repo").hidden = false;
  });

  $("#btn-import-upload").addEventListener("change", () => {
    if (!activeId) { QAFToast.error("Open or create a suite first.", "No suite open"); $("#btn-import-upload").value = ""; return; }
    const file = $("#btn-import-upload").files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      QAFToast.error("That file is larger than 3MB — paste the relevant part instead.", "File too large");
      $("#btn-import-upload").value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      insertAtCursor(e.target.result);
      QAFToast.success(`"${file.name}" inserted into the editor.`);
      $("#btn-import-upload").value = "";
    };
    reader.onerror = () => QAFToast.error("Couldn't read that file.");
    reader.readAsText(file);
  });

  refresh().then(() => {
    const openId = new URLSearchParams(location.search).get("open");
    if (openId && suites.some((s) => s.id === openId)) openSuite(openId);
  });
})();
