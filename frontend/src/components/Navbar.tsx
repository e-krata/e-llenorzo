import { useState, useEffect } from "react";
import ProfilePanel from "./ProfilePanel";
import NotificationPanel, { useUnreadCount } from "./NotificationPanel";
import { GetLocalProfile } from "../../wailsjs/go/main/App";
import type { AccountInfo } from "../types/kreta";

export type PageId =
  | "home"
  | "orarend"
  | "osztalyzatok"
  | "hazik"
  | "fuzet"
  | "szamonkeresek"
  | "hianyzasok"
  | "jutattasok"
  | "dkt"
  | "beallitasok";

interface NavbarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  account?: AccountInfo | null;
  onLogout: () => void;
  onSwitchAccount: (account: AccountInfo) => void;
  isOnline?: boolean;
  lastSync?: Date | null;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

const navItems: { id: PageId; label: string }[] = [
  { id: "orarend", label: "Órarend" },
  { id: "osztalyzatok", label: "Osztályzatok" },
  { id: "hazik", label: "Házi feladatok" },
  { id: "szamonkeresek", label: "Számonkérések" },
  { id: "hianyzasok", label: "Hiányzások" },
  { id: "fuzet", label: "Füzet" },
];

export default function Navbar({
  currentPage,
  onNavigate,
  account,
  onLogout,
  onSwitchAccount,
  isOnline = true,
  lastSync,
}: NavbarProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [avatarB64, setAvatarB64] = useState("");
  const unread = useUnreadCount();

  useEffect(() => {
    GetLocalProfile()
      .then((p) => setAvatarB64(p?.avatarB64 ?? ""))
      .catch(() => {});
  }, [account?.id]);

  const handlePanelClose = () => {
    setPanelOpen(false);
    GetLocalProfile()
      .then((p) => setAvatarB64(p?.avatarB64 ?? ""))
      .catch(() => {});
  };

  return (
    <>
      <nav className="navbar">
        <button
          className="navbar-brand"
          onClick={() => onNavigate("home")}
          aria-label="Főoldal"
        >
          Toll
        </button>

        <div className="navbar-links">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-link${currentPage === item.id ? " active" : ""}`}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="navbar-sync">
          <span className={`sync-dot ${isOnline ? "sync-online" : "sync-offline"}`} />
          <span className={`sync-label ${isOnline ? "" : "sync-label-offline"}`}>
            {isOnline ? "Szinkronizálva" : "Offline – cache"}
          </span>
        </div>

        <button
          className={`nav-link${currentPage === "beallitasok" ? " active" : ""}`}
          onClick={() => onNavigate("beallitasok")}
          title="Beállítások"
          aria-label="Beállítások"
          style={{ marginLeft: "8px" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle" }}>
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        <button
          className="navbar-bell"
          onClick={() => setNotifOpen((o) => !o)}
          aria-label="Értesítések"
          title="Értesítések"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unread > 0 && (
            <span className="bell-badge">{unread > 99 ? "99+" : unread}</span>
          )}
        </button>

        <button
          className="navbar-avatar"
          onClick={() => setPanelOpen(true)}
          title={account?.name ?? "Profil"}
          aria-label="Profil megnyitása"
          style={{ padding: avatarB64 ? 0 : undefined, overflow: "hidden" }}
        >
          {avatarB64 ? (
            <img
              src={avatarB64}
              alt="Profilkép"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: "inherit",
                display: "block",
              }}
            />
          ) : account ? (
            initials(account.name)
          ) : (
            "?"
          )}
        </button>
      </nav>

      {notifOpen && (
        <NotificationPanel onClose={() => setNotifOpen(false)} />
      )}

      <ProfilePanel
        isOpen={panelOpen}
        onClose={handlePanelClose}
        account={account ?? null}
        onLogout={() => {
          setPanelOpen(false);
          onLogout();
        }}
        onSwitchAccount={(acc) => {
          setPanelOpen(false);
          onSwitchAccount(acc);
        }}
      />
    </>
  );
}
