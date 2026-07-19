(function () {
  const $ = (s) => document.querySelector(s);

  // ---------- Tool switching ----------
  document.querySelectorAll(".tool-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".tool-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      document.querySelectorAll(".tool-panel").forEach((p) => p.classList.remove("active"));
      $("#tool-placeholder").classList.add("hidden");
      $("#panel-" + card.dataset.tool).classList.add("active");
    });
  });

  // ================= Test case generator =================
  const TOPIC_RULES = [
    { keys: ["login", "sign in", "auth"], cases: [
      "Valid credentials log the user in successfully",
      "Incorrect password shows a clear error and does not log in",
      "Unknown/unregistered email shows an appropriate error",
      "Empty username or password fields are blocked with validation",
      "Account lockout after repeated failed attempts (if applicable)",
      "Session persists correctly after refresh; expires after timeout",
      "Password field masks input; 'show password' toggle works",
      "SQL injection / script injection attempts are safely rejected",
    ]},
    { keys: ["upload", "file"], cases: [
      "Uploading a supported file type succeeds",
      "Uploading an unsupported file type is rejected with a clear message",
      "Uploading a file over the size limit is rejected",
      "Uploading a 0-byte / empty file is handled gracefully",
      "Drag-and-drop upload works the same as click-to-browse",
      "Progress indicator shown for large files",
      "Cancelling mid-upload leaves no orphaned data",
      "Duplicate file name handled (overwrite, rename, or reject)",
    ]},
    { keys: ["search"], cases: [
      "Search with a valid, common term returns expected results",
      "Search with no matches shows a friendly empty state",
      "Empty search query is handled without error",
      "Special characters and long strings don't break the query",
      "Search is case-insensitive (unless spec says otherwise)",
      "Pagination or infinite scroll of results works correctly",
      "Search performance is acceptable under large result sets",
    ]},
    { keys: ["checkout", "payment", "cart", "coupon"], cases: [
      "Valid payment details complete the order successfully",
      "Declined/invalid card shows a clear, non-technical error",
      "Coupon/promo code applies the correct discount",
      "Expired or invalid coupon code is rejected with a message",
      "Cart total, tax, and shipping recalculate correctly on quantity change",
      "Removing the last item empties the cart correctly",
      "Order confirmation and receipt reflect the final charged amount",
      "Concurrent stock changes don't allow overselling",
    ]},
    { keys: ["api", "endpoint", "service"], cases: [
      "Valid request returns expected 2xx response and schema",
      "Missing required fields return a 4xx with a descriptive error",
      "Invalid auth token returns 401/403 as appropriate",
      "Rate limiting behaves as documented under burst traffic",
      "Malformed JSON body is rejected without a server error",
      "Pagination parameters return correct page boundaries",
      "Response times stay within agreed SLA under normal load",
    ]},
    { keys: ["form"], cases: [
      "All required fields block submission when empty",
      "Field-level validation messages are specific and clear",
      "Max length limits are enforced client- and server-side",
      "Special characters and emoji don't break rendering or storage",
      "Tab order and keyboard-only submission work correctly",
      "Form retains entered data after a validation error",
    ]},
  ];
  const GENERIC_CASES = [
    "Boundary values (min, max, min-1, max+1) behave correctly",
    "Empty / null / whitespace-only input is handled gracefully",
    "Extremely long input doesn't break layout or storage",
    "Behavior is consistent across supported browsers",
    "Behavior is consistent on mobile viewport sizes",
    "Feature is usable via keyboard only (accessibility)",
    "Network failure mid-action shows a recoverable error, not a crash",
    "Rapid repeated clicks/submits don't create duplicate actions",
  ];

  $("#tc-generate").addEventListener("click", () => {
    const topic = $("#tc-input").value.trim();
    if (!topic) { QAFToast.error("Describe what you're testing first.", "Nothing to generate from"); return; }
    const lower = topic.toLowerCase();
    const matched = TOPIC_RULES.filter((r) => r.keys.some((k) => lower.includes(k)));
    const out = $("#tc-output");
    out.innerHTML = "";
    if (matched.length) {
      matched.forEach((m) => {
        out.innerHTML += `<div class="gc-cat">${escapeHtml(m.keys[0])}-related</div>`;
        m.cases.forEach((c) => out.innerHTML += checklistItem(c));
      });
    }
    out.innerHTML += `<div class="gc-cat">General coverage</div>`;
    GENERIC_CASES.forEach((c) => out.innerHTML += checklistItem(c));
    if (!matched.length) {
      QAFToast.info("No exact keyword match — showing general-purpose coverage. Try adding words like \"login\", \"upload\", \"checkout\", or \"API\".");
    }
  });
  function checklistItem(text) {
    return `<label><input type="checkbox"> <span>${escapeHtml(text)}</span></label>`;
  }

  // ================= Test data generator =================
  const FIRST_NAMES = ["Maria", "Jose", "Ana", "Juan", "Liza", "Mark", "Ethan", "Grace", "Noah", "Zoe", "Leo", "Mia", "Ivan", "Carla", "Ben", "Nora"];
  const LAST_NAMES = ["Santos", "Reyes", "Cruz", "Garcia", "Bautista", "Torres", "Flores", "Ramos", "Diaz", "Castro", "Lopez", "Mendoza"];
  const STREETS = ["Rizal St", "Mabini Ave", "Maple Rd", "Sunset Blvd", "5th Ave", "Orchard Ln", "Bayview Dr", "Cedar St"];
  const CITIES = ["Bacoor", "Manila", "Cebu City", "Austin", "Toronto", "London", "Singapore", "Sydney"];

  function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function luhnCardNumber() {
    // Generates a fake but Luhn-valid 16-digit test card number (not a real card)
    let digits = [4]; // starts like a Visa test pattern, clearly fictitious
    for (let i = 0; i < 14; i++) digits.push(randInt(0, 9));
    let sum = 0, alt = true;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = digits[i];
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      sum += d; alt = !alt;
    }
    const check = (10 - (sum % 10)) % 10;
    digits.push(check);
    return digits.join("").replace(/(.{4})/g, "$1 ").trim();
  }

  function genRow(type) {
    switch (type) {
      case "person": return `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`;
      case "email": return `${rand(FIRST_NAMES).toLowerCase()}.${rand(LAST_NAMES).toLowerCase()}${randInt(1, 99)}@example.com`;
      case "phone": return `+1-${randInt(200, 999)}-${randInt(200, 999)}-${randInt(1000, 9999)}`;
      case "card": return luhnCardNumber() + "  (test only — not a real card)";
      case "uuid": return crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16); });
      case "address": return `${randInt(1, 999)} ${rand(STREETS)}, ${rand(CITIES)}`;
      default: return "";
    }
  }

  $("#td-generate").addEventListener("click", () => {
    const type = $("#td-type").value;
    const count = Math.min(200, Math.max(1, parseInt($("#td-count").value) || 1));
    const rows = Array.from({ length: count }, () => genRow(type));
    $("#td-output").textContent = rows.join("\n");
  });
  $("#td-copy").addEventListener("click", () => {
    const text = $("#td-output").textContent;
    if (!text || text === "Nothing generated yet.") { QAFToast.error("Generate some data first."); return; }
    navigator.clipboard.writeText(text).then(() => QAFToast.success("Copied to clipboard."));
  });

  // ================= Regex tester =================
  $("#rx-run").addEventListener("click", () => {
    const pattern = $("#rx-pattern").value;
    const flags = $("#rx-flags").value.replace(/[^gimsuy]/g, "");
    const text = $("#rx-text").value;
    if (!pattern) { QAFToast.error("Enter a pattern first."); return; }
    let re;
    try { re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g"); }
    catch (e) { $("#rx-output").textContent = "Invalid pattern: " + e.message; return; }
    const matches = [...text.matchAll(re)];
    if (!matches.length) { $("#rx-output").textContent = "No matches found."; return; }
    $("#rx-output").textContent = `${matches.length} match${matches.length === 1 ? "" : "es"}:\n\n` +
      matches.map((m, i) => `${i + 1}. "${m[0]}"  (at index ${m.index})` + (m.length > 1 ? `\n   groups: ${m.slice(1).map((g) => JSON.stringify(g)).join(", ")}` : "")).join("\n");
  });

  // ================= Selector helper =================
  $("#sel-generate").addEventListener("click", () => {
    const desc = $("#sel-input").value.trim();
    if (!desc) { QAFToast.error("Describe the element first."); return; }
    const tag = $("#sel-tag").value || "element";
    const slug = desc.toLowerCase().replace(/['"]/g, "").trim();
    const out = [
      `// Playwright — prefer role/text locators over CSS when possible`,
      `page.getByRole('${tag === "button" ? "button" : tag === "a" ? "link" : tag === "input" ? "textbox" : "button"}', { name: '${desc}' })`,
      `page.getByText('${desc}', { exact: false })`,
      `page.getByLabel('${desc}')  // if it's a labeled form field`,
      `page.getByTestId('${slug.replace(/\s+/g, "-")}')  // if your app sets data-testid`,
      ``,
      `// CSS fallback`,
      `${tag !== "element" ? tag : "*"}[aria-label*="${desc}" i]`,
      `${tag !== "element" ? tag : "*"}:has-text("${desc}")`,
      ``,
      `// XPath fallback`,
      `//${tag !== "element" ? tag : "*"}[contains(normalize-space(.), "${desc}")]`,
      ``,
      `Tip: getByRole + accessible name is the most resilient to markup changes.`,
    ];
    $("#sel-output").textContent = out.join("\n");
  });

  // ================= AI Chat (bring your own key) =================
  const KEY_STORAGE = "qaf-ai-key";
  const PROVIDER_STORAGE = "qaf-ai-provider";
  $("#chat-provider").value = localStorage.getItem(PROVIDER_STORAGE) || "anthropic";
  $("#chat-key").value = localStorage.getItem(KEY_STORAGE) || "";

  $("#chat-save-key").addEventListener("click", () => {
    localStorage.setItem(KEY_STORAGE, $("#chat-key").value.trim());
    localStorage.setItem(PROVIDER_STORAGE, $("#chat-provider").value);
    QAFToast.success("Key saved locally in this browser only.");
  });

  function appendChat(role, text) {
    const log = $("#chat-log");
    const div = document.createElement("div");
    div.className = "chat-msg " + role;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  async function sendChat() {
    const msg = $("#chat-input").value.trim();
    if (!msg) return;
    const key = localStorage.getItem(KEY_STORAGE);
    const provider = localStorage.getItem(PROVIDER_STORAGE) || "anthropic";
    if (!key) {
      appendChat("sys", "Save an API key above first.");
      return;
    }
    appendChat("user", msg);
    $("#chat-input").value = "";
    appendChat("sys", "Sending…");
    try {
      let text;
      if (provider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 800, messages: [{ role: "user", content: msg }] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
        text = data.content?.map((c) => c.text || "").join("\n") || "(empty response)";
      } else {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
          body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: msg }] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
        text = data.choices?.[0]?.message?.content || "(empty response)";
      }
      $("#chat-log").lastChild.remove();
      appendChat("ai", text);
    } catch (err) {
      $("#chat-log").lastChild.remove();
      appendChat("sys", `Request failed: ${err.message}. This is often the provider blocking direct browser calls (CORS) — the offline tools above work regardless.`);
    }
  }
  $("#chat-send").addEventListener("click", sendChat);
  $("#chat-input").addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });

  // ================= AI test automation =================
  function detectFunctionName(code) {
    if (!code) return null;
    const m = code.match(/function\s+([A-Za-z_$][\w$]*)/) ||
      code.match(/const\s+([A-Za-z_$][\w$]*)\s*=\s*(\(|function|async)/) ||
      code.match(/class\s+([A-Za-z_$][\w$]*)/);
    return m ? m[1] : null;
  }

  function generateUnitSuite(description, pastedCode) {
    const fnName = detectFunctionName(pastedCode) || "targetFunction";
    const lower = description.toLowerCase();
    let cases;
    if (/email/.test(lower)) {
      cases = [
        `expect(${fnName}("user@example.com")).toBeTruthy();`,
        `expect(${fnName}("not-an-email")).toBeFalsy();`,
        `expect(${fnName}("")).toBeFalsy();`,
      ];
    } else if (/password/.test(lower)) {
      cases = [
        `expect(${fnName}("Str0ngP@ss!")).toBeTruthy();`,
        `expect(${fnName}("weak")).toBeFalsy();`,
        `expect(${fnName}("")).toBeFalsy();`,
      ];
    } else if (/discount|price|total|checkout|cart|coupon/.test(lower)) {
      cases = [
        `expect(${fnName}(100, "SAVE10")).toBe(90);`,
        `expect(${fnName}(100, "INVALID")).toBe(100);`,
        `expect(${fnName}(0, "SAVE10")).toBe(0);`,
      ];
    } else if (/sort|order/.test(lower)) {
      cases = [
        `expect(${fnName}([3, 1, 2])).toEqual([1, 2, 3]);`,
        `expect(${fnName}([])).toEqual([]);`,
      ];
    } else if (/valid|regex|format/.test(lower)) {
      cases = [
        `expect(${fnName}("valid-input")).toBeTruthy();`,
        `expect(${fnName}("")).toBeFalsy();`,
        `expect(${fnName}(null)).toBeFalsy();`,
      ];
    } else {
      cases = [
        `// TODO: replace with a real call, e.g. expect(${fnName}(/* input */)).toBe(/* expected */);`,
        `expect(typeof ${fnName}).toBe("function");`,
      ];
    }
    const header = pastedCode && pastedCode.trim()
      ? pastedCode.trim() + "\n\n"
      : `// Paste or write ${fnName}'s implementation above this line if it isn't here already.\n\n`;
    const title = description || "behaves as expected";
    return `${header}describe("${fnName}", () => {\n` +
      cases.map((c, i) => `  it("case ${i + 1}: ${title}", () => {\n    ${c}\n  });`).join("\n\n") +
      `\n});\n`;
  }

  function generateIntegrationSuite(description) {
    const lower = description.toLowerCase();
    let url = "https://api.example.com/endpoint";
    let method = "GET";
    if (/login|auth/.test(lower)) { url = "https://api.example.com/auth/login"; method = "POST"; }
    else if (/search/.test(lower)) { url = "https://api.example.com/search?q=test"; }
    else if (/upload/.test(lower)) { url = "https://api.example.com/upload"; method = "POST"; }
    const opts = method !== "GET" ? `, { method: "${method}" }` : "";
    return `// Swap the URL below for your real endpoint. Requires the API to allow
// cross-origin (CORS) requests from the browser, same as the API Tester page.
describe("${description || "API endpoint"}", () => {
  it("returns a successful response", async () => {
    const res = await fetch("${url}"${opts});
    expect(res.status).toBeLessThan(400);
  });

  it("returns the expected shape", async () => {
    const res = await fetch("${url}"${opts});
    const data = await res.json();
    expect(data).toBeDefined();
  });
});
`;
  }

  function stripFences(text) {
    return text.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/, "").trim();
  }

  async function callAIForTests(description, pastedCode, type, key, provider) {
    const prompt = `Write a ${type} test suite in JavaScript using a Jest-like API (describe, it, expect with matchers like toBe, toEqual, toBeTruthy, toBeFalsy, toThrow, toContain, toHaveLength).${type === "integration" ? " It's fine to use real fetch() calls." : ""}
Description: ${description || "(not provided)"}
${pastedCode ? `Code being tested:\n${pastedCode}` : ""}
Return ONLY the JavaScript code — no explanation, no markdown fences.`;

    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json", "x-api-key": key,
          "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1200, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      return stripFences(data.content?.map((c) => c.text || "").join("\n") || "");
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      return stripFences(data.choices?.[0]?.message?.content || "");
    }
  }

  $("#ta-generate").addEventListener("click", async () => {
    const description = $("#ta-description").value.trim();
    const pastedCode = $("#ta-code").value;
    const type = $("#ta-type").value;
    if (!description && !pastedCode) {
      QAFToast.error("Describe what to test, or paste some code first.", "Nothing to generate from");
      return;
    }
    const key = localStorage.getItem("qaf-ai-key");
    const provider = localStorage.getItem("qaf-ai-provider") || "anthropic";
    let code;
    if (key) {
      $("#ta-output").textContent = "Asking your connected AI…";
      try {
        code = await callAIForTests(description, pastedCode, type, key, provider);
        if (!code) throw new Error("empty response");
      } catch (err) {
        QAFToast.error(`AI request failed (${err.message}) — using the built-in generator instead.`, "Falling back");
        code = type === "unit" ? generateUnitSuite(description, pastedCode) : generateIntegrationSuite(description);
      }
    } else {
      code = type === "unit" ? generateUnitSuite(description, pastedCode) : generateIntegrationSuite(description);
    }
    $("#ta-output").textContent = code;
  });

  $("#ta-copy").addEventListener("click", () => {
    const text = $("#ta-output").textContent;
    if (!text || text === "Generated test code will appear here.") { QAFToast.error("Generate a suite first."); return; }
    navigator.clipboard.writeText(text).then(() => QAFToast.success("Copied to clipboard."));
  });

  $("#ta-send-runner").addEventListener("click", async () => {
    const code = $("#ta-output").textContent;
    if (!code || code === "Generated test code will appear here." || code === "Asking your connected AI…") {
      QAFToast.error("Generate a suite first.");
      return;
    }
    const type = $("#ta-type").value;
    const desc = $("#ta-description").value.trim() || "ai-generated";
    const slug = desc.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "ai-suite";
    const name = `${slug}.${type}.test.js`;
    const now = Date.now();
    const suite = { id: QAFDB.uid(), name, type, code, createdAt: now, updatedAt: now, lastRun: null };
    await QAFDB.put("testSuites", suite);
    QAFToast.success("Suite created — opening in Test Runner…");
    setTimeout(() => { location.href = `test-runner.html?open=${suite.id}`; }, 500);
  });
})();
