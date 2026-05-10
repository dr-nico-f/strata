import { useStore } from "../store";

/**
 * Copies the current URL (with year/layers/projection/theme already encoded)
 * to the clipboard and surfaces a toast. If a tooltip is pinned, embeds the
 * pinned feature in the URL so the recipient lands on the same focused view.
 */
export function ShareButton() {
  const setToast = useStore((s) => s.setToast);
  const locked = useStore((s) => s.locked);
  const hideUi = useStore((s) => s.hideUi);

  if (hideUi) return null;

  function onClick() {
    const url = new URL(window.location.href);
    if (locked && locked.id) {
      url.searchParams.set("focus", `${locked.layer}:${locked.id}`);
    } else {
      url.searchParams.delete("focus");
    }
    const text = url.toString();
    const finish = (msg: string) => {
      setToast(msg);
      setTimeout(() => {
        if (useStore.getState().toast === msg) {
          useStore.getState().setToast(null);
        }
      }, 2400);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => finish("Link copied"))
        .catch(() => finish("Couldn't copy link"));
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        finish("Link copied");
      } catch {
        finish("Couldn't copy link");
      }
      document.body.removeChild(ta);
    }
  }

  return (
    <button
      onClick={onClick}
      title="Copy a shareable link to this view (S)"
      style={{
        flex: 1,
        padding: "6px 10px",
        background: "var(--panel-hover, rgba(255, 255, 255, 0.06))",
        border: "1px solid var(--panel-border, rgba(255, 255, 255, 0.1))",
        borderRadius: 6,
        color: "inherit",
        cursor: "pointer",
        fontSize: 12,
      }}
    >
      🔗 Share
    </button>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  const hideUi = useStore((s) => s.hideUi);
  if (!toast || hideUi) return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 200,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "8px 14px",
        background: "var(--panel-bg, rgba(20, 22, 30, 0.95))",
        color: "var(--panel-fg, #e8e8ee)",
        border: "1px solid var(--panel-border, rgba(255, 255, 255, 0.12))",
        borderRadius: 999,
        fontSize: 12,
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
        zIndex: 250,
        pointerEvents: "none",
      }}
    >
      {toast}
    </div>
  );
}
