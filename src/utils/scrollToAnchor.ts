/** Smooth-scrolls to an element by id and briefly highlights it so the reader's eye lands on it. */
export function scrollToAnchor(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  el.classList.remove("fn-flash");
  // Force reflow so the highlight restarts when the same target is clicked twice.
  void el.offsetWidth;
  el.classList.add("fn-flash");
  window.history.replaceState(null, "", `#${id}`);
  return true;
}

/**
 * For links into another document: the target only exists after the page transition
 * finishes, so retry each frame until it mounts (gives up after ~1.5s).
 */
export function scrollToAnchorWhenReady(id: string, timeoutMs = 1500) {
  const start = performance.now();
  const tick = () => {
    if (scrollToAnchor(id)) return;
    if (performance.now() - start < timeoutMs) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
