import { useState, useEffect } from "react";
import Navbar, { PageId } from "./components/Navbar";
import Footer from "./components/Footer";
import HomePage from "./components/HomePage";
import OrarendPage from "./components/OrarendPage";
import OsztalyzatokPage from "./components/OsztalyzatokPage";
import HaziFeladatokPage from "./components/HaziFeladatokPage";
import FuzetPage from "./components/FuzetPage";
import SzamonkeresekPage from "./components/SzamonkeresekPage";
import HianyzasokPage from "./components/HianyzasokPage";
import ChangelogScreen from "./components/ChangelogScreen";
import SettingsPage from "./components/SettingsPage";
import LoginPage from "./components/LoginPage";
import { GetCurrentAccount, GetChangesSinceLastOpen, GetCurrentTheme, GetCustomColor } from "../wailsjs/go/main/App";
import type { AccountInfo } from "./types/kreta";
import type { models } from "../wailsjs/go/models";
import { markSync } from "./utils/sync";
import { applyTheme } from "./theme";
import "./App.css";

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="placeholder-page">
      <p className="placeholder-title">{title}</p>
      <p className="placeholder-sub">Ez az oldal hamarosan elérhető lesz.</p>
    </div>
  );
}

function fmtLastSync(d: Date): string {
  return d.toLocaleString("hu-HU", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function App() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<PageId>("home");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState<Date | null>(() => {
    const s = localStorage.getItem("toll_last_sync");
    return s ? new Date(s) : null;
  });
  const [changes, setChanges] = useState<models.Change[]>([]);
  const [changelogDismissed, setChangelogDismissed] = useState(false);
  const [currentTheme, setCurrentTheme] = useState("Zöld");

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const now = new Date();
      setLastSync(now);
      localStorage.setItem("toll_last_sync", now.toISOString());
    };
    const handleOffline = () => setIsOnline(false);
    const handleSync = (e: Event) => setLastSync((e as CustomEvent<Date>).detail);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("toll-sync", handleSync);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("toll-sync", handleSync);
    };
  }, []);

  useEffect(() => {
    GetCurrentTheme()
      .then(async (name) => {
        const theme = name || "Zöld";
        if (theme === "Egyedi") {
          const color = await GetCustomColor().catch(() => "#2d6a4f");
          applyTheme("Egyedi", color);
        } else {
          applyTheme(theme);
        }
        setCurrentTheme(theme);
      })
      .catch(() => applyTheme("Zöld"));
  }, []);

  useEffect(() => {
    GetCurrentAccount()
      .then((acc) => {
        setAccount(acc ?? null);
        setLoading(false);
        markSync();
        if (acc) {
          GetChangesSinceLastOpen()
            .then((cs) => setChanges(cs ?? []))
            .catch(() => {});
        }
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          color: "var(--text-secondary)",
          fontSize: "1rem",
        }}
      >
        Betöltés…
      </div>
    );
  }

  if (!account) {
    return <LoginPage onLogin={setAccount} />;
  }

  if (changes.length >= 2 && !changelogDismissed) {
    return (
      <ChangelogScreen
        changes={changes}
        onDismiss={() => setChangelogDismissed(true)}
      />
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case "home":           return <HomePage account={account} />;
      case "orarend":        return <OrarendPage />;
      case "osztalyzatok":   return <OsztalyzatokPage themeKey={currentTheme} />;
      case "hazik":          return <HaziFeladatokPage />;
      case "fuzet":          return <FuzetPage />;
      case "szamonkeresek":  return <SzamonkeresekPage />;
      case "hianyzasok":     return <HianyzasokPage />;
      case "jutattasok":     return <PlaceholderPage title="Juttatások" />;
      case "dkt":            return <PlaceholderPage title="DKT" />;
      case "beallitasok":    return (
        <SettingsPage
          currentTheme={currentTheme}
          onThemeChange={setCurrentTheme}
        />
      );
    }
  };

  return (
    <div id="app-layout">
      <Navbar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        account={account}
        onLogout={() => setAccount(null)}
        onSwitchAccount={setAccount}
        isOnline={isOnline}
        lastSync={lastSync}
      />
      {!isOnline && (
        <div className="offline-banner">
          Offline mód – utolsó szinkron:{" "}
          {lastSync ? fmtLastSync(lastSync) : "ismeretlen"}
        </div>
      )}
      <main className="main-content">{renderPage()}</main>
      <Footer />
    </div>
  );
}

export default App;
