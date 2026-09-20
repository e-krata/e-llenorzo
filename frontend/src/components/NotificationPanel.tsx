import { useState, useEffect, useRef } from "react";
import { GetNotifications, MarkAllRead, MarkRead, GetUnreadCount } from "../../wailsjs/go/main/App";
import type { models } from "../../wailsjs/go/models";

const TYPE_LABEL: Record<string, string> = {
  grade: "Jegy",
  absence: "Hiányzás",
  exam: "Számonkérés",
};

function fmtTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

function groupByDate(ns: models.Notification[]): { date: string; items: models.Notification[] }[] {
  const map = new Map<string, models.Notification[]>();
  for (const n of ns) {
    const day = n.timestamp?.slice(0, 10) ?? "ismeretlen";
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(n);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

interface Props {
  onClose: () => void;
}

export default function NotificationPanel({ onClose }: Props) {
  const [notifications, setNotifications] = useState<models.Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = () => {
    GetNotifications()
      .then((ns) => {
        setNotifications(ns ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleMarkAll = async () => {
    await MarkAllRead();
    load();
  };

  const handleMarkOne = async (id: number) => {
    await MarkRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  };

  const unread = notifications.filter((n) => !n.isRead).length;
  const groups = groupByDate(notifications);

  return (
    <div className="notif-overlay">
      <div className="notif-panel" ref={panelRef}>
        <div className="notif-header">
          <span className="notif-title">Értesítések</span>
          {unread > 0 && (
            <button className="notif-mark-all" onClick={handleMarkAll}>
              Mind olvasott
            </button>
          )}
          <button className="notif-close" onClick={onClose} aria-label="Bezárás">×</button>
        </div>

        <div className="notif-body">
          {loading && <p className="notif-empty">Betöltés…</p>}
          {!loading && notifications.length === 0 && (
            <p className="notif-empty">Nincs értesítés.</p>
          )}
          {groups.map(({ date, items }) => (
            <div key={date} className="notif-group">
              <div className="notif-group-date">{date}</div>
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item${n.isRead ? " notif-item-read" : ""}`}
                  onClick={() => !n.isRead && handleMarkOne(n.id)}
                >
                  <span className={`notif-type-badge notif-type-${n.type}`}>
                    {TYPE_LABEL[n.type] ?? n.type}
                  </span>
                  <span className="notif-content">{n.content}</span>
                  <span className="notif-time">{fmtTimestamp(n.timestamp)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function useUnreadCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => GetUnreadCount().then(setCount).catch(() => {});
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, []);

  return count;
}
