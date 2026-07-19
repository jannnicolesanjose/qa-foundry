/* Mobile nav toggle */
document.addEventListener("DOMContentLoaded", () => {
  const shell = document.querySelector(".app-shell");
  const toggle = document.querySelector(".menu-toggle");
  const scrim = document.querySelector(".sidebar-scrim");

  function close() { shell?.classList.remove("nav-open"); }
  function open() { shell?.classList.add("nav-open"); }

  toggle?.addEventListener("click", () => {
    shell.classList.contains("nav-open") ? close() : open();
  });
  scrim?.addEventListener("click", close);
  document.querySelectorAll(".nav-link").forEach((l) => l.addEventListener("click", close));
});
