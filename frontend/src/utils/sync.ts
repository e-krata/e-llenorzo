export function markSync() {
  const now = new Date();
  localStorage.setItem("toll_last_sync", now.toISOString());
  window.dispatchEvent(new CustomEvent("toll-sync", { detail: now }));
}
