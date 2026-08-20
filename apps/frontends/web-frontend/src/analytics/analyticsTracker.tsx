import { useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  IDLE_THRESHOLD_MS,
  currentUsageContext,
  featureName,
  flushAnalytics,
  measure,
  measureElementTime,
} from "./analytics";

const TIME_BUCKET_MS = 15_000;
const FLUSH_INTERVAL_MS = 30_000;

function AnalyticsTracker(): null {
  const { user } = useAuth();

  useEffect(() => {
    if (user === null) return;
    let lastActivityAt = Date.now();
    let lastTickAt = Date.now();
    let lastPath = window.location.pathname;
    let idleThresholdMs = IDLE_THRESHOLD_MS;
    const token = localStorage.getItem("id_token");
    void fetch("/api/analytics/config", { headers: token === null ? {} : { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() as Promise<{ idleThresholdSeconds?: number }> : null)
      .then((config) => { if (config !== null && typeof config.idleThresholdSeconds === "number") idleThresholdMs = Math.max(30_000, config.idleThresholdSeconds * 1000); })
      .catch(() => undefined);

    const pageFeature = (path: string): string => {
      const context = currentUsageContext(path);
      return `page:${context.technicalElement ?? path.split("/").filter(Boolean)[0] ?? "home"}`;
    };

    const onActivity = (): void => { lastActivityAt = Date.now(); };
    const onClick = (event: MouseEvent): void => {
      onActivity();
      const feature = featureName(event.target);
      if (feature !== null) measure(feature);
    };
    const tick = (): void => {
      const now = Date.now();
      if (document.hidden) { lastTickAt = now; return; }
      const path = window.location.pathname;
      if (path !== lastPath) {
        lastPath = path;
        measure(pageFeature(path));
      }
      const elapsed = Math.min(TIME_BUCKET_MS * 2, Math.max(0, now - lastTickAt));
      const idle = now - lastActivityAt >= idleThresholdMs;
      measureElementTime(idle ? 0 : elapsed, idle ? elapsed : 0, currentUsageContext(path));
      lastTickAt = now;
    };
    const onVisibility = (): void => {
      if (document.hidden) {
        tick();
        void flushAnalytics(true);
      } else {
        lastTickAt = Date.now();
      }
    };
    const onUnload = (): void => { tick(); void flushAnalytics(true); };

    window.addEventListener("keydown", onActivity, { passive: true });
    window.addEventListener("pointermove", onActivity, { passive: true });
    window.addEventListener("scroll", onActivity, { passive: true });
    window.addEventListener("touchstart", onActivity, { passive: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onUnload);
    const timeInterval = window.setInterval(tick, TIME_BUCKET_MS);
    const flushInterval = window.setInterval(() => { void flushAnalytics(); }, FLUSH_INTERVAL_MS);
    measure(pageFeature(lastPath));

    return () => {
      tick();
      void flushAnalytics(true);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("pointermove", onActivity);
      window.removeEventListener("scroll", onActivity);
      window.removeEventListener("touchstart", onActivity);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onUnload);
      window.clearInterval(timeInterval);
      window.clearInterval(flushInterval);
    };
  }, [user]);

  return null;
}

export { AnalyticsTracker };
