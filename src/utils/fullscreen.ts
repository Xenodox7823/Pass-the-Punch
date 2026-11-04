/**
 * Utility to request browser fullscreen mode on user interaction
 */
export function triggerFullscreen() {
  if (typeof document === 'undefined') return;

  const doc = document as unknown as {
    fullscreenElement?: Element;
    webkitFullscreenElement?: Element;
    mozFullScreenElement?: Element;
    msFullscreenElement?: Element;
    documentElement: HTMLElement & {
      requestFullscreen?: () => Promise<void>;
      webkitRequestFullscreen?: () => Promise<void>;
      mozRequestFullScreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };
  };

  const isFullscreen =
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement;

  if (!isFullscreen) {
    const el = doc.documentElement;
    const req =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.mozRequestFullScreen ||
      el.msRequestFullscreen;

    if (req) {
      req.call(el).catch(() => {
        // Silent catch: in some iframes, full-screen might be blocked by permissions
      });
    }
  }
}
