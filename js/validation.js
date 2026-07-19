/* Shared validation helpers used across every feature page */
(function () {
  const DOC_EXT = [".pdf", ".doc", ".docx"];
  const DOC_MIME = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
  const VIDEO_EXT = [".mp4", ".webm", ".mov"];
  const SHEET_EXT = [".xlsx", ".xls", ".csv"];

  function extOf(name) {
    const i = name.lastIndexOf(".");
    return i === -1 ? "" : name.slice(i).toLowerCase();
  }

  function validateFile(file, { allowedExt, maxSizeMB }) {
    const errors = [];
    const ext = extOf(file.name);
    if (allowedExt && !allowedExt.includes(ext)) {
      errors.push(`"${file.name}" isn't a supported file type. Allowed: ${allowedExt.join(", ")}`);
    }
    if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
      errors.push(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${maxSizeMB}MB.`);
    }
    if (file.size === 0) {
      errors.push(`"${file.name}" appears to be empty.`);
    }
    return errors;
  }

  function setFieldError(fieldEl, message) {
    if (!fieldEl) return;
    fieldEl.classList.add("has-error");
    const errEl = fieldEl.querySelector(".error-text");
    if (errEl) errEl.textContent = message;
  }

  function clearFieldError(fieldEl) {
    if (!fieldEl) return;
    fieldEl.classList.remove("has-error");
  }

  function requireText(value, label, min = 1) {
    if (!value || value.trim().length < min) {
      return `${label} is required.`;
    }
    return null;
  }

  function isValidUrl(str) {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  function fmtBytes(bytes) {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function fmtDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) +
      " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return fmtDate(ts);
  }

  window.QAFValidate = {
    DOC_EXT, DOC_MIME, IMAGE_EXT, VIDEO_EXT, SHEET_EXT,
    extOf, validateFile, setFieldError, clearFieldError,
    requireText, isValidUrl, fmtBytes, fmtDate, timeAgo,
  };
})();
