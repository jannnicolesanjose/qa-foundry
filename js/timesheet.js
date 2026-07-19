(function () {
  const $ = (s) => document.querySelector(s);
  const TIMER_KEY = "qaf-timer-state";
  const PROFILE_KEY = "qaf-timesheet-profile";
  const DAY_SHORT = ["Su", "M", "T", "W", "TH", "F", "S"];
  const LUNCH_BREAK_MAX_HOURS = 1; // 1 hour cap
  const LEAVE_TYPES = ["Paid Leave", "Sick Leave"];
  let entries = [];
  let saveTimers = {};
  let timerInterval = null;

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }
  function nowHHMM() {
    const d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function toMinutes(hhmm) {
    if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }
  // Hours worked = raw time span minus the lunch break (in hours).
  function computeHours(timeIn, timeOut, lunchBreakHours) {
    const inM = toMinutes(timeIn), outM = toMinutes(timeOut);
    if (inM === null || outM === null) return 0;
    let diff = outM - inM;
    if (diff < 0) diff += 24 * 60; // crossed midnight
    let hours = diff / 60 - (Number(lunchBreakHours) || 0);
    if (hours < 0) hours = 0;
    return Math.round(hours * 100) / 100;
  }
  function dayLabel(dateStr) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return "";
    const dt = new Date(y, m - 1, d);
    return DAY_SHORT[dt.getDay()];
  }
  function fmtHoursOrMins(hours) {
    if (hours < 1) return Math.round(hours * 60) + "m";
    return hours.toFixed(2) + "h";
  }
  function escapeAttr(str) {
    return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }
  // Read the lunch break as hours, migrating older data stored as minutes
  function lunchHoursOf(e) {
    if (e.lunchBreakHours !== undefined) return e.lunchBreakHours;
    if (e.lunchBreakMinutes !== undefined) return e.lunchBreakMinutes / 60;
    if (e.breakMinutes !== undefined) return e.breakMinutes / 60;
    return 0;
  }

  // ---------- Profile (employee / pay period) ----------
  function loadProfile() {
    let profile = {};
    try { profile = JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch { profile = {}; }
    $("#profile-name").value = profile.name || "";
    $("#profile-position").value = profile.position || "";
    $("#profile-period-start").value = profile.periodStart || "";
    $("#profile-period-end").value = profile.periodEnd || "";
  }
  function saveProfile() {
    const profile = {
      name: $("#profile-name").value.trim(),
      position: $("#profile-position").value.trim(),
      periodStart: $("#profile-period-start").value,
      periodEnd: $("#profile-period-end").value,
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return profile;
  }
  function getProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch { return {}; }
  }
  ["profile-name", "profile-position", "profile-period-start", "profile-period-end"].forEach((id) => {
    document.getElementById(id).addEventListener("change", saveProfile);
  });

  // ---------- Load / render ----------
  async function refresh() {
    entries = await QAFDB.getAll("timesheetEntries");
    await populateTaskSuggestions();
    render();
  }

  async function populateTaskSuggestions() {
    const todos = await QAFDB.getAll("todos");
    const fromEntries = entries.map((e) => e.task).filter(Boolean);
    const fromTodos = todos.map((t) => t.title).filter(Boolean);
    const unique = [...new Set([...fromTodos, ...fromEntries])];
    $("#task-suggestions").innerHTML = unique.map((t) => `<option value="${escapeAttr(t)}">`).join("");
  }

  function filteredEntries() {
    const from = $("#filter-from").value, to = $("#filter-to").value;
    let list = entries.slice();
    if (from) list = list.filter((e) => e.date >= from);
    if (to) list = list.filter((e) => e.date <= to);
    return list.sort((a, b) => (a.date + (a.timeIn || "")).localeCompare(b.date + (b.timeIn || "")));
  }

  function autoGrow(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  function lunchInput(id, val) {
    const shown = Number(val) > 0 ? val : "";
    return `<input type="number" min="0" max="${LUNCH_BREAK_MAX_HOURS}" step="0.25" placeholder="0" class="ts-cell-input ts-cell-center" data-id="${id}" data-key="lunchBreakHours" value="${shown}">`;
  }

  function leaveTypeSelect(id, val) {
    return `<select class="ts-cell-select-leave" data-id="${id}" data-key="leaveType">` +
      LEAVE_TYPES.map((t) => `<option ${t === val ? "selected" : ""}>${t}</option>`).join("") +
      `</select>`;
  }

  function render() {
    const list = filteredEntries();
    $("#ts-empty").classList.toggle("hidden", entries.length !== 0);

    const body = $("#ts-body");
    body.innerHTML = "";
    const timerState = getTimerState();
    list.forEach((e, idx) => {
      const tr = document.createElement("tr");
      if (timerState && timerState.entryId === e.id) tr.classList.add("row-active");
      if (e.isLeave) {
        tr.classList.add("row-leave");
        tr.innerHTML = `
          <td class="ts-row-num">${idx + 1}</td>
          <td><input type="date" class="ts-cell-input ts-cell-center" data-id="${e.id}" data-key="date" value="${e.date || ""}"></td>
          <td class="ts-cell-day">${dayLabel(e.date)}</td>
          <td>${leaveTypeSelect(e.id, e.leaveType)}</td>
          <td class="ts-cell-disabled">—</td>
          <td class="ts-cell-disabled">—</td>
          <td><input type="number" min="0" max="24" step="0.5" placeholder="8" class="ts-cell-input ts-hours-editable" data-id="${e.id}" data-key="hours" value="${e.hours || ""}"></td>
          <td class="ts-cell-top"><textarea class="ts-cell-textarea" list="task-suggestions" data-id="${e.id}" data-key="task" placeholder="Report / task">${escapeAttr(e.task || "")}</textarea></td>
          <td class="ts-cell-top"><textarea class="ts-cell-textarea" data-id="${e.id}" data-key="notes" placeholder="Notes — press Enter for a new bullet">${escapeAttr(e.notes || "")}</textarea></td>
          <td class="ts-row-actions"><button class="icon-btn" data-del="${e.id}" title="Delete row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button></td>`;
        body.appendChild(tr);
        return;
      }
      if (lunchHoursOf(e) > 0) tr.classList.add("row-has-break");
      tr.innerHTML = `
        <td class="ts-row-num">${idx + 1}</td>
        <td><input type="date" class="ts-cell-input ts-cell-center" data-id="${e.id}" data-key="date" value="${e.date || ""}"></td>
        <td class="ts-cell-day">${dayLabel(e.date)}</td>
        <td><input type="time" class="ts-cell-input" data-id="${e.id}" data-key="timeIn" value="${e.timeIn || ""}"></td>
        <td>${lunchInput(e.id, lunchHoursOf(e))}</td>
        <td><input type="time" class="ts-cell-input" data-id="${e.id}" data-key="timeOut" value="${e.timeOut || ""}"></td>
        <td class="ts-cell-readonly">${fmtHoursOrMins(e.hours || 0)}</td>
        <td class="ts-cell-top"><textarea class="ts-cell-textarea" list="task-suggestions" data-id="${e.id}" data-key="task" placeholder="Report / task">${escapeAttr(e.task || "")}</textarea></td>
        <td class="ts-cell-top"><textarea class="ts-cell-textarea" data-id="${e.id}" data-key="notes" placeholder="Notes — press Enter for a new bullet">${escapeAttr(e.notes || "")}</textarea></td>
        <td class="ts-row-actions"><button class="icon-btn" data-del="${e.id}" title="Delete row">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button></td>`;
      body.appendChild(tr);
    });

    body.querySelectorAll(".ts-cell-input, .ts-cell-select-leave").forEach((el) => {
      el.addEventListener("input", () => scheduleSave(el));
      el.addEventListener("change", () => scheduleSave(el));
    });
    body.querySelectorAll(".ts-cell-textarea").forEach((el) => {
      autoGrow(el);
      el.addEventListener("input", () => { autoGrow(el); scheduleSave(el); });
      el.addEventListener("keydown", (ev) => handleBulletKeydown(ev, el));
    });
    body.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => deleteRow(b.dataset.del)));

    renderSummary(list);
  }

  // Auto-continue a bullet list: Enter inserts a new "• " line
  function handleBulletKeydown(ev, el) {
    if (ev.key !== "Enter" || ev.shiftKey) return;
    ev.preventDefault();
    const start = el.selectionStart, end = el.selectionEnd;
    const before = el.value.slice(0, start), after = el.value.slice(end);
    const insertion = "\n• ";
    el.value = before + insertion + after;
    const pos = start + insertion.length;
    el.selectionStart = el.selectionEnd = pos;
    autoGrow(el);
    scheduleSave(el);
  }

  function scheduleSave(el) {
    const id = el.dataset.id, key = el.dataset.key;
    clearTimeout(saveTimers[id + key]);
    saveTimers[id + key] = setTimeout(async () => {
      const entry = entries.find((e) => e.id === id);
      if (!entry) return;

      if (key === "lunchBreakHours") {
        let val = Math.max(0, Number(el.value) || 0);
        if (val > LUNCH_BREAK_MAX_HOURS) {
          val = LUNCH_BREAK_MAX_HOURS;
          QAFToast.error(`Lunch break is capped at ${LUNCH_BREAK_MAX_HOURS} hour.`, "Adjusted");
        }
        entry.lunchBreakHours = val;
        delete entry.lunchBreakMinutes; // migrate off legacy fields
        delete entry.breakMinutes;
        entry.hours = computeHours(entry.timeIn, entry.timeOut, lunchHoursOf(entry));
      } else if (key === "hours" && entry.isLeave) {
        const val = Math.max(0, Math.min(24, Number(el.value) || 0));
        entry.hours = Math.round(val * 100) / 100;
      } else {
        entry[key] = el.value;
        if (key === "timeIn" || key === "timeOut") {
          entry.hours = computeHours(entry.timeIn, entry.timeOut, lunchHoursOf(entry));
        }
      }
      entry.updatedAt = Date.now();
      await QAFDB.put("timesheetEntries", entry);
      if (key === "timeIn" || key === "timeOut" || key === "date" || key === "lunchBreakHours") render();
      else renderSummary(filteredEntries());
    }, 350);
  }

  async function deleteRow(id) {
    if (!confirm("Delete this timesheet entry?")) return;
    await QAFDB.delete("timesheetEntries", id);
    QAFToast.success("Entry deleted.");
    refresh();
  }

  function renderSummary(list) {
    const totalHours = list.reduce((sum, e) => sum + (e.hours || 0), 0);
    const totalLeaveHours = list.filter((e) => e.isLeave).reduce((sum, e) => sum + (e.hours || 0), 0);
    const totalLunchHours = list.reduce((sum, e) => sum + (Number(lunchHoursOf(e)) || 0), 0);
    const days = new Set(list.map((e) => e.date)).size;
    const avg = days ? totalHours / days : 0;
    const today = list.filter((e) => e.date === todayStr()).reduce((s, e) => s + (e.hours || 0), 0);
    $("#summary-strip").innerHTML = `
      <div class="summary-tile"><div class="s-num">${totalHours.toFixed(2)}h</div><div class="s-label">Hours (filtered, incl. leave)</div></div>
      <div class="summary-tile tile-break"><div class="s-num">${totalLeaveHours.toFixed(2)}h</div><div class="s-label">Leave hours</div></div>
      <div class="summary-tile tile-break"><div class="s-num">${totalLunchHours.toFixed(2)}h</div><div class="s-label">Lunch Break Total</div></div>
      <div class="summary-tile"><div class="s-num">${list.length}</div><div class="s-label">Entries</div></div>
      <div class="summary-tile"><div class="s-num">${days}</div><div class="s-label">Days logged</div></div>
      <div class="summary-tile"><div class="s-num">${avg.toFixed(2)}h</div><div class="s-label">Avg / day</div></div>
      <div class="summary-tile"><div class="s-num">${today.toFixed(2)}h</div><div class="s-label">Today</div></div>
    `;
  }

  // ---------- Add row ----------
  $("#btn-add-entry").addEventListener("click", async () => {
    const entry = {
      id: QAFDB.uid(), date: todayStr(), timeIn: "", timeOut: "",
      lunchBreakHours: 0, hours: 0,
      task: "", notes: "", createdAt: Date.now(), updatedAt: Date.now(),
    };
    await QAFDB.put("timesheetEntries", entry);
    QAFToast.success("New row added.");
    await refresh();
    document.querySelector(`[data-id="${entry.id}"][data-key="timeIn"]`)?.focus();
  });

  $("#btn-add-leave").addEventListener("click", async () => {
    const entry = {
      id: QAFDB.uid(), date: todayStr(), isLeave: true, leaveType: LEAVE_TYPES[0], hours: 8,
      task: "", notes: "", createdAt: Date.now(), updatedAt: Date.now(),
    };
    await QAFDB.put("timesheetEntries", entry);
    QAFToast.success("Leave entry added.");
    await refresh();
  });

  // ---------- Filters ----------
  $("#filter-from").addEventListener("change", render);
  $("#filter-to").addEventListener("change", render);
  $("#btn-clear-filter").addEventListener("click", () => { $("#filter-from").value = ""; $("#filter-to").value = ""; render(); });
  $("#btn-this-week").addEventListener("click", () => {
    const now = new Date();
    const day = (now.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(now); monday.setDate(now.getDate() - day);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    $("#filter-from").value = monday.toISOString().slice(0, 10);
    $("#filter-to").value = sunday.toISOString().slice(0, 10);
    render();
  });

  // ---------- Timer automation ----------
  function getTimerState() {
    try { return JSON.parse(localStorage.getItem(TIMER_KEY)); } catch { return null; }
  }
  function setTimerState(state) {
    if (state) localStorage.setItem(TIMER_KEY, JSON.stringify(state));
    else localStorage.removeItem(TIMER_KEY);
  }
  function formatElapsed(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const s = String(totalSec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }
  function updateTimerUI() {
    const state = getTimerState();
    const widget = $("#timer-widget");
    const btn = $("#btn-timer-toggle");
    if (state && state.running) {
      widget.classList.add("running");
      btn.textContent = "Clock out";
      $("#timer-task").value = state.task || "";
      $("#timer-clock").textContent = formatElapsed(Date.now() - state.startedAt);
    } else {
      widget.classList.remove("running");
      btn.textContent = "Clock in";
      $("#timer-clock").textContent = "00:00:00";
    }
  }

  $("#btn-timer-toggle").addEventListener("click", async () => {
    const state = getTimerState();
    if (state && state.running) {
      const entry = entries.find((e) => e.id === state.entryId) || (await QAFDB.get("timesheetEntries", state.entryId));
      if (entry) {
        entry.timeOut = nowHHMM();
        entry.hours = computeHours(entry.timeIn, entry.timeOut, lunchHoursOf(entry));
        entry.updatedAt = Date.now();
        await QAFDB.put("timesheetEntries", entry);
      }
      setTimerState(null);
      clearInterval(timerInterval);
      QAFToast.success(`Clocked out. Logged ${entry ? entry.hours.toFixed(2) : "0"}h.`);
      await refresh();
    } else {
      const task = $("#timer-task").value.trim();
      const entry = {
        id: QAFDB.uid(), date: todayStr(), timeIn: nowHHMM(), timeOut: "",
        lunchBreakHours: 0, hours: 0,
        task, notes: "", createdAt: Date.now(), updatedAt: Date.now(),
      };
      await QAFDB.put("timesheetEntries", entry);
      setTimerState({ running: true, entryId: entry.id, startedAt: Date.now(), task });
      QAFToast.success("Clocked in — timing your work now.");
      await refresh();
      startTicking();
    }
    updateTimerUI();
  });

  $("#timer-task").addEventListener("input", async () => {
    const state = getTimerState();
    if (!state || !state.running) return;
    state.task = $("#timer-task").value.trim();
    setTimerState(state);
    const entry = entries.find((e) => e.id === state.entryId);
    if (entry) {
      entry.task = state.task;
      entry.updatedAt = Date.now();
      await QAFDB.put("timesheetEntries", entry);
    }
  });

  function startTicking() {
    clearInterval(timerInterval);
    timerInterval = setInterval(updateTimerUI, 1000);
  }

  // ---------- Bullet-aware export formatting ----------
  function bulletLines(text) {
    return (text || "").split(/\n+/).map((l) => l.replace(/^•\s*/, "").trim()).filter(Boolean);
  }
  function bulletExportText(text) {
    const lines = bulletLines(text);
    if (lines.length <= 1) return lines[0] || "";
    return lines.map((l) => "• " + l).join("\n");
  }
  function bulletHtml(text) {
    const lines = bulletLines(text);
    if (lines.length === 0) return "";
    if (lines.length === 1) return escapeAttr(lines[0]);
    return `<ul style="margin:0; padding-left:16px;">` + lines.map((l) => `<li>${escapeAttr(l)}</li>`).join("") + `</ul>`;
  }

  function exportRows() {
    return filteredEntries().map((e) => {
      if (e.isLeave) {
        return {
          Date: e.date || "", Day: dayLabel(e.date), "Time In": `LEAVE — ${e.leaveType || "Other"}`,
          "Lunch Break (hrs)": "", "Time Out": "",
          Hours: (e.hours || 0).toFixed(2), Task: bulletExportText(e.task), Notes: bulletExportText(e.notes),
          IsLeave: true,
        };
      }
      return {
        Date: e.date || "", Day: dayLabel(e.date), "Time In": e.timeIn || "",
        "Lunch Break (hrs)": (Number(lunchHoursOf(e)) || 0).toFixed(2),
        "Time Out": e.timeOut || "",
        Hours: (e.hours || 0).toFixed(2), Task: bulletExportText(e.task), Notes: bulletExportText(e.notes),
        IsLeave: false,
      };
    });
  }

  function totalsFor(rows) {
    const hours = rows.reduce((s, r) => s + parseFloat(r.Hours || 0), 0);
    const leaveHours = rows.filter((r) => r.IsLeave).reduce((s, r) => s + parseFloat(r.Hours || 0), 0);
    const lunchHours = rows.reduce((s, r) => s + (parseFloat(r["Lunch Break (hrs)"]) || 0), 0);
    return { hours, leaveHours, lunchHours };
  }

  function headerLines() {
    const p = getProfile();
    const lines = [];
    if (p.name) lines.push(`Employee: ${p.name}`);
    if (p.position) lines.push(`Position: ${p.position}`);
    if (p.periodStart || p.periodEnd) lines.push(`Pay Period: ${p.periodStart || "…"} to ${p.periodEnd || "…"}`);
    return lines;
  }

  // ---------- Exports ----------
  $("#btn-export").addEventListener("click", () => {
    $("#export-menu").hidden = !$("#export-menu").hidden;
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdown")) $("#export-menu").hidden = true;
  });

  // 1-based column order for exports: Date, Day, Time In, Lunch Break, Time Out, Hours, Task, Notes
  const XLSX_COLS = ["Date", "Day", "Time In", "Lunch Break (hrs)", "Time Out", "Hours", "Task", "Notes"];
  const XLSX_CENTER_COLS = [1, 2, 3, 4, 5, 6]; // Date, Day, Time In, Lunch Break, Time Out, Hours

  $("#export-xlsx").addEventListener("click", async () => {
    const rows = exportRows();
    if (!rows.length) { QAFToast.error("There's nothing to export in this date range.", "No entries"); return; }
    if (typeof ExcelJS === "undefined") { QAFToast.error("The spreadsheet engine failed to load — check your connection.", "Can't export"); return; }
    const { hours, leaveHours, lunchHours } = totalsFor(rows);
    const header = headerLines();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Timesheet");
    ws.addRow(["Personal — Timesheet"]).font = { bold: true, size: 18 };
    header.forEach((l) => ws.addRow([l]));
    ws.addRow([`Total hours (15 days): ${hours.toFixed(2)}`, `Leave Taken: ${leaveHours.toFixed(2)}`, `Lunch Break Total (15 days): ${lunchHours.toFixed(2)}h`]);
    ws.addRow([]);

    const headerRow = ws.addRow(XLSX_COLS);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF6DBD7" } }; });
    headerRow.eachCell((cell) => { cell.alignment = { horizontal: "center", vertical: "middle" }; });

    rows.forEach((r) => {
      const row = ws.addRow(XLSX_COLS.map((c) => (c === "Lunch Break (hrs)" ? (r[c] === "" ? "" : Number(r[c])) : r[c])));
      XLSX_CENTER_COLS.forEach((col) => { row.getCell(col).alignment = { horizontal: "center", vertical: "middle" }; });
      row.getCell(7).alignment = { wrapText: true, vertical: "top" };
      row.getCell(8).alignment = { wrapText: true, vertical: "top" };
    });

    ws.columns = [
      { width: 12 }, { width: 6 }, { width: 18 }, { width: 14 }, { width: 10 }, { width: 9 }, { width: 38 }, { width: 46 },
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `timesheet-${rangeLabel()}.xlsx`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    $("#export-menu").hidden = true;
    QAFToast.success("Excel file downloaded, with Date/Day/Time/Hours columns centered.");
  });

  $("#export-pdf").addEventListener("click", () => {
    const rows = exportRows();
    if (!rows.length) { QAFToast.error("There's nothing to export in this date range.", "No entries"); return; }
    if (typeof window.jspdf === "undefined") { QAFToast.error("The PDF engine failed to load — check your connection.", "Can't export"); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Personal — Timesheet", 14, 16);
    doc.setFontSize(9.5);
    doc.setTextColor(100);
    let y = 23;
    headerLines().forEach((l) => { doc.text(l, 14, y); y += 5; });
    const { hours, leaveHours, lunchHours } = totalsFor(rows);
    doc.text(`Total hours (15 days): ${hours.toFixed(2)}  |  Leave Taken (Hours): ${leaveHours.toFixed(2)}  |  Lunch Break Total (15 days): ${lunchHours.toFixed(2)}h`, 14, y);
    doc.autoTable({
      startY: y + 5,  
      head: [["Date", "Day", "Time In", "Lunch Break (hrs)", "Time Out", "Hours", "Report / Task", "Notes"]],
      body: rows.map((r) => XLSX_COLS.map((c) => r[c])),
      styles: { fontSize: 8.5, valign: "middle" },
      headStyles: { fillColor: [193, 85, 71], halign: "center", valign: "middle" },
      columnStyles: {
        0: { halign: "center" }, 1: { halign: "center" }, 2: { halign: "center" },
        3: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center" },
        6: { cellWidth: 70, valign: "top" }, 7: { cellWidth: 80, valign: "top" },
      },
    });
    doc.save(`timesheet-${rangeLabel()}.pdf`);
    $("#export-menu").hidden = true;
    QAFToast.success("PDF downloaded.");
  });

  $("#export-doc").addEventListener("click", () => {
    const rows = exportRows();
    if (!rows.length) { QAFToast.error("There's nothing to export in this date range.", "No entries"); return; }
    const { hours, leaveHours, lunchHours } = totalsFor(rows);
    const c = ' align="center" valign="middle" class="center"';
    const tableRows = rows.map((r) => `
      <tr>
        <td${c}>${escapeAttr(r.Date)}</td><td${c}>${escapeAttr(r.Day)}</td><td${c}>${escapeAttr(r["Time In"])}</td>
        <td${c}>${escapeAttr(r["Lunch Break (hrs)"])}</td><td${c}>${escapeAttr(r["Time Out"])}</td><td${c}>${escapeAttr(r.Hours)}</td>
        <td>${bulletHtml(r.Task)}</td><td>${bulletHtml(r.Notes)}</td>
      </tr>`).join("");
    const headerHtml = headerLines().map((l) => `<p style="margin:2px 0;">${escapeAttr(l)}</p>`).join("");
    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset="utf-8"><title>Timesheet</title>
      <style>
        body { font-family: Calibri, Arial, sans-serif; }
        h1 { color: #B14E47; font-size: 20px; }
        table { border-collapse: collapse; width: 100%; margin-top: 12px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; text-align: left; vertical-align: top; }
        th.center, td.center { text-align: center; vertical-align: middle; }
        th { background: #F6DBD7; color: #4A211D; text-align: center; }
        ul { margin: 0; padding-left: 16px; }
      </style></head>
      <body>
        <h1>Personal — Timesheet</h1>
        ${headerHtml}
        <p>Range: ${escapeAttr(rangeLabel(true))} &nbsp; | &nbsp; Total hours (15 days): ${hours.toFixed(2)} &nbsp; | &nbsp; Leave Taken (Hours): ${leaveHours.toFixed(2)} &nbsp; | &nbsp; Lunch Break Total (15 days): ${lunchHours.toFixed(2)}h</p>
        <table>
          <tr><th>Date</th><th>Day</th><th>Time In</th><th>Lunch Break (hrs)</th><th>Time Out</th><th>Hours</th><th style="text-align:left;">Report / Task</th><th style="text-align:left;">Notes</th></tr>
          ${tableRows}
        </table>
      </body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `timesheet-${rangeLabel()}.doc`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    $("#export-menu").hidden = true;
    QAFToast.success("Word document downloaded.");
  });

  function rangeLabel(readable = false) {
    const from = $("#filter-from").value, to = $("#filter-to").value;
    if (!from && !to) return readable ? "All entries" : "all";
    if (readable) return `${from || "…"} to ${to || "…"}`;
    return `${from || "start"}_to_${to || "end"}`;
  }

  // ---------- Init ----------
  (function init() {
    loadProfile();
    const state = getTimerState();
    if (state && state.running) startTicking();
    updateTimerUI();
    refresh();
  })();
})();
