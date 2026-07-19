(function () {
  const $ = (s) => document.querySelector(s);
  const COLUMNS = [
    { key: "title", label: "Title", type: "text", wide: true },
    { key: "module", label: "Module", type: "text" },
    { key: "severity", label: "Severity", type: "select", options: ["Low", "Medium", "High", "Critical"] },
    { key: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High", "Critical"] },
    { key: "status", label: "Status", type: "select", options: ["Open", "In Progress", "Retest", "Resolved", "Closed"] },
    { key: "steps", label: "Steps to Reproduce", type: "text", wide: true },
    { key: "expected", label: "Expected Behavior", type: "text", wide: true },
    { key: "actual", label: "Actual Behavior", type: "text", wide: true },
    { key: "environment", label: "Environment", type: "text" },
    { key: "reportedBy", label: "Reported By", type: "text" },
    { key: "date", label: "Date", type: "date" },
  ];

  let bugs = [];
  let sortKey = null, sortDir = 1;
  let saveTimers = {};

  async function refresh() {
    bugs = await QAFDB.getAll("bugs");
    render();
  }

  function renderHead() {
    const head = $("#sheet-head");
    head.innerHTML = `<th style="min-width:40px;">#</th>` +
      COLUMNS.map((c) => `<th data-sort="${c.key}">${c.label}<span class="sort-ind">${sortKey === c.key ? (sortDir === 1 ? "▲" : "▼") : ""}</span></th>`).join("") +
      `<th style="min-width:40px;"></th>`;
    head.querySelectorAll("[data-sort]").forEach((th) => th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (sortKey === key) sortDir *= -1; else { sortKey = key; sortDir = 1; }
      render();
    }));
  }

  function render() {
    renderHead();
    const search = ($("#bug-search").value || "").toLowerCase();
    let rows = bugs.slice();
    if (search) rows = rows.filter((b) => COLUMNS.some((c) => (b[c.key] || "").toString().toLowerCase().includes(search)));
    if (sortKey) rows.sort((a, b) => (a[sortKey] || "").toString().localeCompare((b[sortKey] || "").toString()) * sortDir);

    $("#bug-count").textContent = `${rows.length} bug${rows.length === 1 ? "" : "s"}`;
    $("#bug-empty").classList.toggle("hidden", bugs.length !== 0);

    const body = $("#sheet-body");
    body.innerHTML = "";
    rows.forEach((b, idx) => {
      const tr = document.createElement("tr");
      let html = `<td class="row-num">${idx + 1}</td>`;
      COLUMNS.forEach((c) => {
        if (c.type === "select") {
          html += `<td><select class="cell-select" data-id="${b.id}" data-key="${c.key}">` +
            c.options.map((o) => `<option ${b[c.key] === o ? "selected" : ""}>${o}</option>`).join("") + `</select></td>`;
        } else if (c.type === "date") {
          html += `<td><input type="date" class="cell-input" data-id="${b.id}" data-key="${c.key}" value="${b[c.key] || ""}"></td>`;
        } else {
          html += `<td><input type="text" class="cell-input ${c.wide ? "wide" : ""}" data-id="${b.id}" data-key="${c.key}" value="${escapeAttr(b[c.key] || "")}"></td>`;
        }
      });
      html += `<td class="row-actions"><button class="icon-btn" data-del="${b.id}" title="Delete row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button></td>`;
      tr.innerHTML = html;
      body.appendChild(tr);
    });

    body.querySelectorAll(".cell-input, .cell-select").forEach((el) => {
      el.addEventListener("input", () => scheduleSave(el));
      el.addEventListener("change", () => scheduleSave(el));
    });
    body.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => deleteRow(b.dataset.del)));

    applySeverityColors();
  }

  function escapeAttr(str) {
    return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function applySeverityColors() {
    document.querySelectorAll('select[data-key="severity"]').forEach((sel) => {
      sel.className = "cell-select sev-" + sel.value;
    });
  }

  function scheduleSave(el) {
    const id = el.dataset.id, key = el.dataset.key;
    clearTimeout(saveTimers[id + key]);
    saveTimers[id + key] = setTimeout(async () => {
      const bug = bugs.find((b) => b.id === id);
      if (!bug) return;
      bug[key] = el.value;
      bug.updatedAt = Date.now();
      await QAFDB.put("bugs", bug);
      if (key === "severity") applySeverityColors();
    }, 350);
  }

  async function deleteRow(id) {
    if (!confirm("Delete this bug row?")) return;
    await QAFDB.delete("bugs", id);
    QAFToast.success("Row deleted.");
    refresh();
  }

  $("#btn-add-row").addEventListener("click", async () => {
    const bug = { id: QAFDB.uid(), title: "", module: "", severity: "Medium", priority: "Medium", status: "Open",
      steps: "", expected: "", actual: "", environment: "", reportedBy: localStorage.getItem("qaf-author") || "",
      date: new Date().toISOString().slice(0, 10), createdAt: Date.now(), updatedAt: Date.now() };
    await QAFDB.put("bugs", bug);
    QAFToast.success("New row added.");
    await refresh();
    const firstInput = document.querySelector(`[data-id="${bug.id}"][data-key="title"]`);
    firstInput?.focus();
  });

  $("#btn-export-csv").addEventListener("click", () => {
    if (bugs.length === 0) { QAFToast.error("There's nothing to export yet.", "Sheet is empty"); return; }
    const header = COLUMNS.map((c) => c.label).join(",");
    const lines = bugs.map((b) => COLUMNS.map((c) => csvEscape(b[c.key] || "")).join(","));
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `qa-foundry-bugs-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    QAFToast.success("CSV downloaded.");
  });

  function csvEscape(v) {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  $("#bug-search").addEventListener("input", render);

  refresh();
})();
