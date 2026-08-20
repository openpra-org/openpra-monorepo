import { JSX, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type Notification } from "interfaces-shared-types";
import { BellIcon, CheckIcon } from "../welcome/icons";
import { formatRelative } from "../welcome/formatRelative";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notificationsApi";
import "./css/notificationBell.css";

const POLL_MS = 60_000;

function NotificationBell(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  function refresh(): void {
    getNotifications()
      .then((res) => {
        setItems(res.notifications);
        setUnread(res.unreadCount);
      })
      .catch(() => {});
  }

  useEffect(() => {
    refresh();
    const handle = window.setInterval(refresh, POLL_MS);
    return () => { window.clearInterval(handle); };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent): void {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("mousedown", onClick); };
  }, [open]);

  function toggle(): void {
    setOpen((o) => !o);
  }

  function handleItemClick(n: Notification): void {
    if (!n.read) {
      markNotificationRead(n.id)
        .then(() => {
          setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
          setUnread((c) => Math.max(0, c - 1));
        })
        .catch(() => {});
    }
    setOpen(false);
    if (n.link !== null) navigate(n.link);
  }

  function handleMarkAll(): void {
    markAllNotificationsRead()
      .then(() => {
        setItems((prev) => prev.map((x) => ({ ...x, read: true })));
        setUnread(0);
      })
      .catch(() => {});
  }

  return (
    <div className="nb" ref={wrapRef}>
      <button
        type="button"
        className="nb__btn"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <BellIcon />
        {unread > 0 && <span className="nb__badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="nb__pop" role="menu">
          <div className="nb__head">
            <span className="nb__title">Notifications</span>
            {unread > 0 && (
              <button type="button" className="nb__markall" onClick={handleMarkAll}>
                <CheckIcon /> Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="nb__empty">You&apos;re all caught up.</p>
          ) : (
            <ul className="nb__list">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`nb__item${n.read ? "" : " nb__item--unread"}`}
                    onClick={() => { handleItemClick(n); }}
                  >
                    <span className="nb__item-title">{n.title}</span>
                    <span className="nb__item-body">{n.body}</span>
                    <span className="nb__item-time">{formatRelative(n.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export { NotificationBell };
