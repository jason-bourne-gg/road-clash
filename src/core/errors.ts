// Last line of defence. Anything that throws — in the loop, in an event
// handler, anywhere — surfaces as a friendly screen with a Reload button
// instead of a frozen canvas or a raw stack trace. Settings live in
// localStorage, so a reload always recovers cleanly.

let shown = false;

const escapeHtml = (s: string) =>
  s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

export function showErrorScreen(detail?: unknown): void {
  if (shown) return;            // never stack multiple error screens
  shown = true;
  try { console.error('[Road Clash] fatal:', detail); } catch { /* */ }

  const msg = detail instanceof Error ? (detail.stack || detail.message) : String(detail ?? 'Unknown error');
  let root = document.getElementById('error-root');
  if (!root) { root = document.createElement('div'); root.id = 'error-root'; document.body.appendChild(root); }
  injectStyles();
  root.innerHTML = `
    <div class="err-card">
      <div class="err-emoji">🛠️</div>
      <h2>Hit a pothole</h2>
      <p>Road Clash ran into an unexpected problem.<br>Your settings are safe — a reload gets you going again.</p>
      <button id="err-reload">RELOAD GAME</button>
      <details><summary>technical details</summary><pre>${escapeHtml(msg)}</pre></details>
    </div>`;
  document.getElementById('err-reload')?.addEventListener('click', () => location.reload());
}

export function installErrorHandlers(): void {
  // Uncaught synchronous errors (these are real bugs → show the screen).
  addEventListener('error', (e: ErrorEvent) => {
    if (e.error || e.message) showErrorScreen(e.error ?? e.message);
  });
  // Promise rejections (often transient network hiccups) → log, don't nuke the UI.
  addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    console.warn('[Road Clash] unhandled rejection:', e.reason);
    e.preventDefault();
  });
}

let styled = false;
function injectStyles(): void {
  if (styled) return; styled = true;
  const css = `
  #error-root{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
    background:rgba(8,4,16,0.92);font-family:"SF Mono",ui-monospace,Menlo,monospace;color:#fff}
  #error-root .err-card{background:rgba(20,10,28,0.95);border:2px solid #ff5b4a;border-radius:16px;
    padding:28px 34px;max-width:520px;text-align:center;box-shadow:0 12px 60px rgba(0,0,0,.7)}
  #error-root .err-emoji{font-size:46px}
  #error-root h2{color:#ff5b4a;margin:8px 0;font-size:26px}
  #error-root p{color:#e6e6ee;font-size:14px;line-height:1.6}
  #error-root button{margin:14px 0 6px;padding:12px 26px;cursor:pointer;font-family:inherit;font-weight:700;
    font-size:15px;color:#1b1140;background:#ffd23b;border:none;border-radius:11px;letter-spacing:1px}
  #error-root details{margin-top:12px;text-align:left}
  #error-root summary{color:#9a93b0;font-size:12px;cursor:pointer}
  #error-root pre{max-height:160px;overflow:auto;background:rgba(0,0,0,.5);padding:10px;border-radius:8px;
    font-size:11px;color:#c9b8e0;white-space:pre-wrap;word-break:break-word}`;
  const tag = document.createElement('style');
  tag.textContent = css;
  document.head.appendChild(tag);
}
