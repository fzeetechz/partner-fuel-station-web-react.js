import { useEffect, useState, type ReactNode } from "react";
import { authMode, liveAuth } from "./liveAuth";
import { readTokens } from "./tokens";
export function SessionGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(authMode !== "api");
  useEffect(() => {
    if (authMode !== "api") return;
    let mounted = true;
    const restore = () => {
      void liveAuth
        .restore()
        .catch(() => {})
        .finally(() => {
          if (mounted) setReady(true);
        });
    };
    restore();
    const timer = window.setInterval(() => {
      const tokens = readTokens();
      if (tokens && tokens.expiresAt <= Date.now() + 60000) restore();
    }, 15000);
    const onFocus = () => restore();
    window.addEventListener("focus", onFocus);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  return ready ? (
    children
  ) : (
    <div role="status" className="loading-view">
      Restoring your session...
    </div>
  );
}
