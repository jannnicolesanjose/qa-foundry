/* Lightweight toast notifications */
(function () {
  function ensureStack() {
    let stack = document.getElementById("toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "toast-stack";
      document.body.appendChild(stack);
    }
    return stack;
  }

  function toast(message, { type = "info", title = "", duration = 4200 } = {}) {
    const stack = ensureStack();
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.innerHTML = `<div>${title ? `<strong>${escapeHtml(title)}</strong>` : ""}${escapeHtml(message)}</div>`;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity 200ms ease, transform 200ms ease";
      el.style.opacity = "0";
      el.style.transform = "translateX(16px)";
      setTimeout(() => el.remove(), 220);
    }, duration);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  window.QAFToast = {
    success: (msg, title = "Done") => toast(msg, { type: "success", title }),
    error: (msg, title = "Something's wrong") => toast(msg, { type: "error", title }),
    info: (msg, title = "") => toast(msg, { type: "info", title }),
    warn: (msg, title = "Check that") => toast(msg, { type: "error", title }),
  };
  window.escapeHtml = escapeHtml;
})();
