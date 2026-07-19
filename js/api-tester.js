(function () {
  const $ = (s) => document.querySelector(s);
  let history = [];
  let headerRowId = 0;

  function addHeaderRow(key = "", value = "") {
    const id = "hr" + headerRowId++;
    const wrap = $("#header-rows");
    const row = document.createElement("div");
    row.className = "kv-row";
    row.dataset.id = id;
    row.innerHTML = `
      <input type="text" placeholder="Header name" class="h-key" value="${escapeHtml(key)}">
      <input type="text" placeholder="Value" class="h-val" value="${escapeHtml(value)}">
      <button class="icon-btn" data-remove-header><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
    row.querySelector("[data-remove-header]").addEventListener("click", () => row.remove());
    wrap.appendChild(row);
  }
  addHeaderRow("Content-Type", "application/json");
  $("#btn-add-header").addEventListener("click", () => addHeaderRow());

  function collectHeaders() {
    const headers = {};
    document.querySelectorAll("#header-rows .kv-row").forEach((row) => {
      const k = row.querySelector(".h-key").value.trim();
      const v = row.querySelector(".h-val").value.trim();
      if (k) headers[k] = v;
    });
    const token = $("#req-token").value.trim();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  document.querySelectorAll('.tabs [data-tab]').forEach((btn) => btn.addEventListener("click", () => {
    document.querySelectorAll('.tabs [data-tab]').forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    ["headers", "body", "auth"].forEach((t) => $("#req-tab-" + t).classList.toggle("hidden", t !== btn.dataset.tab));
  }));

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-rtab]");
    if (!btn) return;
    document.querySelectorAll('[data-rtab]').forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    ["body", "headers"].forEach((t) => $("#resp-tab-" + t).classList.toggle("hidden", t !== btn.dataset.rtab));
  });

  async function sendRequest() {
    const url = $("#req-url").value.trim();
    QAFValidate.clearFieldError($("#field-url"));
    if (!url || !QAFValidate.isValidUrl(url)) {
      QAFValidate.setFieldError($("#field-url"), "Enter a valid URL, including https://");
      return;
    }
    const method = $("#req-method").value;
    const bodyType = $("#body-type").value;
    const rawBody = $("#req-body").value;
    const headers = collectHeaders();

    let fetchOpts = { method, headers: { ...headers } };
    if (method !== "GET" && bodyType !== "None" && rawBody.trim()) {
      if (bodyType === "JSON") {
        try { JSON.parse(rawBody); } catch {
          QAFToast.error("The request body isn't valid JSON — check for a missing quote or comma.", "Invalid JSON");
          return;
        }
        if (!fetchOpts.headers["Content-Type"]) fetchOpts.headers["Content-Type"] = "application/json";
      }
      fetchOpts.body = rawBody;
    }

    $("#btn-send").disabled = true;
    $("#btn-send").innerHTML = `<span class="spinner"></span> Sending…`;
    const start = performance.now();
    let entry = { id: QAFDB.uid(), method, url, timestamp: Date.now() };

    try {
      const res = await fetch(url, fetchOpts);
      const elapsed = Math.round(performance.now() - start);
      const text = await res.text();
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch {}
      const respHeaders = [...res.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n") || "(no headers exposed)";

      showResponse({ status: res.status, ok: res.ok, time: elapsed, size: new Blob([text]).size, body: pretty, headers: respHeaders });
      entry = { ...entry, status: res.status, time: elapsed };
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      showResponse({ status: 0, ok: false, time: elapsed, size: 0, body: `Request failed: ${err.message}\n\nThis is usually caused by the API blocking cross-origin browser requests (CORS), an invalid URL, or no network access.`, headers: "" });
      entry = { ...entry, status: 0, time: elapsed };
    } finally {
      $("#btn-send").disabled = false;
      $("#btn-send").innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send`;
      await QAFDB.put("apiHistory", entry);
      refreshHistory();
    }
  }

  function showResponse({ status, ok, time, size, body, headers }) {
    $("#response-panel").style.display = "block";
    $("#response-empty").style.display = "none";
    const pill = $("#resp-status");
    pill.textContent = status === 0 ? "No response" : `${status}`;
    pill.className = "status-pill " + (ok ? "status-ok" : "status-err");
    $("#resp-time").textContent = `${time} ms`;
    $("#resp-size").textContent = QAFValidate.fmtBytes(size);
    $("#resp-body").textContent = body || "(empty body)";
    $("#resp-headers").textContent = headers;
  }

  async function refreshHistory() {
    history = await QAFDB.getAll("apiHistory");
    history.sort((a, b) => b.timestamp - a.timestamp);
    const list = $("#history-list");
    if (history.length === 0) { list.innerHTML = `<p class="text-dim" style="font-size:12px;">No requests sent yet.</p>`; return; }
    list.innerHTML = history.slice(0, 40).map((h) => `
      <div class="history-item" data-id="${h.id}">
        <div class="h-top"><span class="method-tag method-${h.method}">${h.method}</span><span class="text-dim" style="font-size:11px;">${h.status || "—"}</span></div>
        <div class="h-url">${escapeHtml(h.url)}</div>
        <div class="text-dim" style="font-size:10.5px;">${QAFValidate.timeAgo(h.timestamp)}</div>
      </div>`).join("");
    list.querySelectorAll(".history-item").forEach((el) => el.addEventListener("click", () => {
      const h = history.find((x) => x.id === el.dataset.id);
      $("#req-method").value = h.method;
      $("#req-url").value = h.url;
    }));
  }

  $("#btn-send").addEventListener("click", sendRequest);
  $("#req-url").addEventListener("keydown", (e) => { if (e.key === "Enter") sendRequest(); });
  $("#btn-clear-history").addEventListener("click", async () => {
    if (!confirm("Clear all API request history?")) return;
    const all = await QAFDB.getAll("apiHistory");
    for (const h of all) await QAFDB.delete("apiHistory", h.id);
    QAFToast.success("History cleared.");
    refreshHistory();
  });

  refreshHistory();
})();
