(function () {
  const $ = (s) => document.querySelector(s);
  const TARGET_FIELDS = [
    { key: "title", label: "Title", guesses: ["title", "bug", "summary title", "name"] },
    { key: "summary", label: "Summary", guesses: ["summary", "overview"] },
    { key: "description", label: "Description", guesses: ["description", "details", "notes"] },
    { key: "currentBehavior", label: "Current Behavior", guesses: ["current", "actual", "actual result", "actual behavior"] },
    { key: "expectedBehavior", label: "Expected Behavior", guesses: ["expected", "expected result", "expected behavior"] },
    { key: "environment", label: "Environment", guesses: ["environment", "env", "browser", "platform"] },
  ];

  let headers = [];
  let rows = [];
  let mapping = {};
  let reports = [];

  const dz = $("#gen-dropzone");
  const fileInput = $("#gen-file-input");

  dz.addEventListener("click", () => fileInput.click());
  dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("drag-over"); });
  dz.addEventListener("dragleave", () => dz.classList.remove("drag-over"));
  dz.addEventListener("drop", (e) => { e.preventDefault(); dz.classList.remove("drag-over"); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  fileInput.addEventListener("change", () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

  function handleFile(file) {
    const errors = QAFValidate.validateFile(file, { allowedExt: QAFValidate.SHEET_EXT, maxSizeMB: 10 });
    if (errors.length) { QAFToast.error(errors[0], "Invalid file"); return; }
    if (typeof XLSX === "undefined") {
      QAFToast.error("The spreadsheet engine failed to load — check your internet connection and try again.", "Can't parse file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        if (!data.length) { QAFToast.error("That sheet doesn't have any rows to import.", "Empty sheet"); return; }
        headers = Object.keys(data[0]);
        rows = data;
        buildMappingUI();
        QAFToast.success(`Parsed ${data.length} row${data.length === 1 ? "" : "s"} from "${file.name}".`);
      } catch (err) {
        QAFToast.error("The file couldn't be read. Make sure it's a valid Excel or CSV export.", "Parse failed");
      }
    };
    reader.onerror = () => QAFToast.error("The file couldn't be read from disk.", "Read failed");
    reader.readAsBinaryString(file);
  }

  function guessColumn(fieldGuesses) {
    const lower = headers.map((h) => h.toLowerCase());
    for (const g of fieldGuesses) {
      const idx = lower.findIndex((h) => h.includes(g));
      if (idx !== -1) return headers[idx];
    }
    return "";
  }

  function buildMappingUI() {
    mapping = {};
    const grid = $("#mapping-grid");
    grid.innerHTML = TARGET_FIELDS.map((f) => {
      const guess = guessColumn(f.guesses);
      mapping[f.key] = guess;
      return `
      <div class="mapping-row">
        <label>${f.label}</label>
        <select data-field="${f.key}">
          <option value="">— None —</option>
          ${headers.map((h) => `<option value="${escapeHtml(h)}" ${h === guess ? "selected" : ""}>${escapeHtml(h)}</option>`).join("")}
        </select>
      </div>`;
    }).join("");
    grid.querySelectorAll("select").forEach((sel) => sel.addEventListener("change", () => { mapping[sel.dataset.field] = sel.value; }));
    $("#mapping-panel").classList.remove("hidden");
    $("#results-panel").classList.add("hidden");
  }

  $("#btn-generate-reports").addEventListener("click", () => {
    if (!mapping.title) {
      QAFToast.error("Map at least the Title column so each report can be identified.", "Missing mapping");
      return;
    }
    reports = rows.map((r, i) => ({
      id: "gen-" + i,
      title: (r[mapping.title] || `Untitled bug #${i + 1}`).toString(),
      summary: (r[mapping.summary] || "").toString(),
      description: (r[mapping.description] || "").toString(),
      currentBehavior: (r[mapping.currentBehavior] || "").toString(),
      expectedBehavior: (r[mapping.expectedBehavior] || "").toString(),
      environment: (r[mapping.environment] || "").toString(),
    }));
    renderReports();
  });

  function renderReports() {
    $("#results-panel").classList.remove("hidden");
    $("#results-count").textContent = `${reports.length} report${reports.length === 1 ? "" : "s"} generated`;
    $("#report-grid").innerHTML = reports.map((r) => `
      <div class="report-card" data-id="${r.id}">
        <div class="rc-head"><div class="rc-title">${escapeHtml(r.title)}</div></div>
        <div class="rc-body">
          ${reportField("Summary", r.summary)}
          ${reportField("Description", r.description)}
          ${reportField("Current Behavior", r.currentBehavior)}
          ${reportField("Expected Behavior", r.expectedBehavior)}
          ${reportField("Environment", r.environment)}
        </div>
        <div class="rc-foot">
          <button class="btn btn-sm" data-copy="${r.id}">Copy</button>
          <button class="btn btn-sm btn-primary" data-add="${r.id}">Add to tracker</button>
        </div>
      </div>`).join("");

    $("#report-grid").querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => copyReport(b.dataset.copy)));
    $("#report-grid").querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", async () => {
      await importReport(reports.find((r) => r.id === b.dataset.add));
      QAFToast.success("Added to Bug Tracker.");
    }));
  }

  function reportField(label, value) {
    if (!value) return "";
    return `<div class="rc-field"><div class="rc-label">${label}</div><div class="rc-value">${escapeHtml(value)}</div></div>`;
  }

  function reportToText(r) {
    let out = `Title: ${r.title}\n`;
    if (r.summary) out += `Summary: ${r.summary}\n`;
    if (r.description) out += `Description: ${r.description}\n`;
    if (r.currentBehavior) out += `Current Behavior: ${r.currentBehavior}\n`;
    if (r.expectedBehavior) out += `Expected Behavior: ${r.expectedBehavior}\n`;
    if (r.environment) out += `Environment: ${r.environment}\n`;
    return out;
  }

  function copyReport(id) {
    const r = reports.find((x) => x.id === id);
    navigator.clipboard.writeText(reportToText(r)).then(
      () => QAFToast.success("Report copied to clipboard."),
      () => QAFToast.error("Couldn't access the clipboard in this browser.")
    );
  }

  async function importReport(r) {
    await QAFDB.put("bugs", {
      id: QAFDB.uid(),
      title: r.title,
      module: "",
      severity: "Medium",
      priority: "Medium",
      status: "Open",
      steps: r.summary || r.description || "",
      expected: r.expectedBehavior,
      actual: r.currentBehavior,
      environment: r.environment,
      reportedBy: localStorage.getItem("qaf-author") || "",
      date: new Date().toISOString().slice(0, 10),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  $("#btn-import-all").addEventListener("click", async () => {
    if (!reports.length) return;
    for (const r of reports) await importReport(r);
    QAFToast.success(`${reports.length} bug${reports.length === 1 ? "" : "s"} added to the Bug Tracker.`);
  });
})();
