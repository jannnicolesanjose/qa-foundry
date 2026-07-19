/* Theme engine — light / dark / system, persisted in localStorage */
(function () {
  const STORAGE_KEY = "qaf-theme";
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function resolve(mode) {
    if (mode === "system") return media.matches ? "dark" : "light";
    return mode;
  }

  function apply(mode) {
    root.setAttribute("data-theme", resolve(mode));
    document.querySelectorAll(".theme-switch button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
  }

  function getMode() {
    return localStorage.getItem(STORAGE_KEY) || "system";
  }

  function setMode(mode) {
    localStorage.setItem(STORAGE_KEY, mode);
    apply(mode);
  }

  media.addEventListener("change", () => {
    if (getMode() === "system") apply("system");
  });

  document.addEventListener("DOMContentLoaded", () => {
    apply(getMode());
    document.querySelectorAll(".theme-switch button").forEach((btn) => {
      btn.addEventListener("click", () => setMode(btn.dataset.mode));
    });
  });

  // Apply immediately (before DOMContentLoaded) to avoid flash of wrong theme
  apply(getMode());

  window.QAFTheme = { getMode, setMode };
})();
