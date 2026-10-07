const READY_ATTRIBUTE = "data-stockgpt-launch-ready";
const LOADER_SELECTOR = "[data-stockgpt-launch-loader]";

/** Track the initial document load, shared by every route's fallback. */
export function observeInitialAppLoad(
  document: Document,
  Observer: typeof MutationObserver = MutationObserver,
) {
  const root = document.documentElement;
  if (root.getAttribute(READY_ATTRIBUTE) === "true") return () => {};

  const observer = new Observer(() => checkReady());
  function checkReady() {
    // React can retain streamed fallback markup in hidden containers. Those
    // fallbacks are no longer the visible startup screen.
    const loading = Array.from(document.querySelectorAll(LOADER_SELECTOR))
      .some((element) => !element.closest("[hidden]"));
    if (loading) return;
    root.setAttribute(READY_ATTRIBUTE, "true");
    observer.disconnect();
  }

  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  checkReady();
  // Cleanup must not reset the latch: layouts and StrictMode may remount it.
  return () => observer.disconnect();
}
