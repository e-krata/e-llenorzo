import {
  useState,
  useRef,
  useEffect,
  ChangeEvent,
  KeyboardEvent,
} from "react";
import {
  GetStudentDetail,
  GetAccounts,
  GetLocalProfile,
  SaveLocalProfile,
  SwitchAccount,
  RemoveAccount,
  Logout,
  OpenDKT,
  OpenGitHub,
  OpenDeveloper,
} from "../../wailsjs/go/main/App";
import type { AccountInfo, StudentDetail, LocalProfile } from "../types/kreta";

type Tab = "profil" | "adataim" | "fiokok";
type AboutModal = "privacy" | "license" | null;

export interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  account: AccountInfo | null;
  onLogout: () => void;
  onSwitchAccount: (account: AccountInfo) => void;
}

function fmtDate(iso: string): string {
  if (!iso) return "–";
  try {
    return new Date(iso).toLocaleDateString("hu-HU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function ProfilePanel({
  isOpen,
  onClose,
  account,
  onLogout,
  onSwitchAccount,
}: ProfilePanelProps) {
  const [tab, setTab] = useState<Tab>("profil");

  const [localProfile, setLocalProfile] = useState<LocalProfile>({
    nickname: "",
    avatarB64: "",
  });
  const [editingNickname, setEditingNickname] = useState(false);
  const [nickEdit, setNickEdit] = useState("");

  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [aboutModal, setAboutModal] = useState<AboutModal>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setTab("profil");
    GetLocalProfile()
      .then((p) => setLocalProfile(p ?? { nickname: "", avatarB64: "" }))
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || tab !== "adataim") return;
    if (detail) return;
    setDetailLoading(true);
    setDetailError(null);
    GetStudentDetail()
      .then((d) => setDetail(d))
      .catch((e: any) =>
        setDetailError(
          typeof e === "string" ? e : e?.message ?? "Ismeretlen hiba"
        )
      )
      .finally(() => setDetailLoading(false));
  }, [isOpen, tab, detail]);

  useEffect(() => {
    if (!isOpen || tab !== "fiokok") return;
    setAccountsLoading(true);
    GetAccounts()
      .then((list) => setAccounts(list ?? []))
      .catch(() => {})
      .finally(() => setAccountsLoading(false));
  }, [isOpen, tab]);

  if (!isOpen) return null;

  const displayName = account?.name ?? "–";
  const displayInitials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0].toUpperCase())
    .join("");

  const saveNickname = () => {
    const updated = { ...localProfile, nickname: nickEdit };
    setLocalProfile(updated);
    setEditingNickname(false);
    SaveLocalProfile(updated).catch(() => {});
  };

  const handleAvatarFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = (ev.target?.result as string) ?? "";
      const updated = { ...localProfile, avatarB64: b64 };
      setLocalProfile(updated);
      SaveLocalProfile(updated).catch(() => {});
    };
    reader.readAsDataURL(file);
  };

  const handleSwitch = async (id: string) => {
    try {
      const switched = await SwitchAccount(id);
      if (switched) onSwitchAccount(switched);
    } catch (e: any) {
      console.error("Switch failed:", e);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await RemoveAccount(id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      if (account?.id === id) onLogout();
    } catch (e: any) {
      console.error("Remove failed:", e);
    }
  };

  const handleLogout = async () => {
    await Logout();
    onLogout();
  };

  return (
    <>
      <div className="pp-backdrop" onClick={onClose} />
      {aboutModal && (
        <div className="about-modal-overlay" onClick={() => setAboutModal(null)}>
          <div className="about-modal-card" onClick={(e) => e.stopPropagation()}>
            {aboutModal === "privacy" && (
              <>
                <div className="about-modal-header">
                  <h2 className="about-modal-title">Adatvédelmi irányelvek</h2>
                </div>
                <div className="about-modal-body">
                  <p>
                    A Toll alkalmazás nem tárol, nem továbbít és nem dolgoz fel semmilyen
                    személyes adatot saját szerverein. Az alkalmazás kizárólag a felhasználó
                    eszközén tárolja a szükséges adatokat (SQLite adatbázis, lokálisan).
                  </p>
                  <p>
                    Az iskolai adatok kezelője és felelőse kizárólag az:<br />
                    <strong>Educational Development Informatikai Zrt.</strong>
                  </p>
                  <p>
                    A Toll fejlesztője nem fér hozzá semmilyen felhasználói adathoz.
                  </p>
                </div>
                <button className="about-modal-close-btn" onClick={() => setAboutModal(null)}>
                  Értettem
                </button>
              </>
            )}
            {aboutModal === "license" && (
              <>
                <div className="about-modal-header">
                  <h2 className="about-modal-title">Licenszek</h2>
                  <button className="about-modal-x" onClick={() => setAboutModal(null)} aria-label="Bezárás">✕</button>
                </div>
                <div className="about-modal-body license-list">
                  {[
                    { name: "Wails", license: "MIT", repo: "github.com/wailsapp/wails" },
                    { name: "React", license: "MIT", repo: "github.com/facebook/react" },
                    { name: "Recharts", license: "MIT", repo: "github.com/recharts/recharts" },
                    { name: "go-pdf/fpdf", license: "MIT", repo: "github.com/go-pdf/fpdf" },
                    { name: "modernc/sqlite", license: "BSD-3-Clause", repo: "modernc.org/sqlite" },
                    { name: "google/uuid", license: "BSD-3-Clause", repo: "github.com/google/uuid" },
                    { name: "gorilla/websocket", license: "BSD-2-Clause", repo: "github.com/gorilla/websocket" },
                    { name: "labstack/echo", license: "MIT", repo: "github.com/labstack/echo" },
                    { name: "samber/lo", license: "MIT", repo: "github.com/samber/lo" },
                    { name: "Vite", license: "MIT", repo: "github.com/vitejs/vite" },
                    { name: "TypeScript", license: "Apache-2.0", repo: "github.com/microsoft/TypeScript" },
                    { name: "pkg/browser", license: "BSD-2-Clause", repo: "github.com/pkg/browser" },
                    { name: "golang.org/x/crypto", license: "BSD-3-Clause", repo: "golang.org/x/crypto" },
                  ].map((dep) => (
                    <div key={dep.name} className="license-entry">
                      <div className="license-entry-top">
                        <span className="license-name">{dep.name}</span>
                        <span className="license-badge">{dep.license}</span>
                      </div>
                      <div className="license-repo">{dep.repo}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <div className="pp-panel" role="dialog" aria-modal="true">
        <div className="pp-header">
          <div className="pp-tabs">
            {(
              [
                ["profil", "Profil"],
                ["adataim", "Adataim"],
                ["fiokok", "Fiókok"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                className={`pp-tab${tab === id ? " active" : ""}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="pp-close" onClick={onClose} aria-label="Bezárás">
            ✕
          </button>
        </div>

        <div className="pp-body">
          {tab === "profil" && (
            <div className="pp-tab-content">
              <div className="pp-avatar-section">
                <button
                  className="pp-avatar-wrap"
                  onClick={() => fileInputRef.current?.click()}
                  title="Profilkép módosítása"
                >
                  {localProfile.avatarB64 ? (
                    <img
                      src={localProfile.avatarB64}
                      className="pp-avatar-img"
                      alt="Profilkép"
                    />
                  ) : (
                    <span className="pp-avatar-initials">{displayInitials}</span>
                  )}
                  <span className="pp-avatar-overlay">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFile}
                  style={{ display: "none" }}
                />
                <div className="pp-fullname">{displayName}</div>
                <div className="pp-upload-hint">
                  Kattints a képre a módosításhoz
                </div>
              </div>

              <div className="pp-section">
                <div className="pp-section-title">Becenév</div>
                {editingNickname ? (
                  <div className="pp-inline-edit">
                    <input
                      className="pp-input"
                      value={nickEdit}
                      autoFocus
                      onChange={(e) => setNickEdit(e.target.value)}
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === "Enter") saveNickname();
                        if (e.key === "Escape") setEditingNickname(false);
                      }}
                    />
                    <div className="pp-edit-actions">
                      <button className="pp-btn-save" onClick={saveNickname}>
                        Mentés
                      </button>
                      <button
                        className="pp-btn-cancel"
                        onClick={() => setEditingNickname(false)}
                      >
                        Mégse
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pp-field-row">
                    <span className="pp-nickname-val">
                      {localProfile.nickname || "(nincs becenév)"}
                    </span>
                    <button
                      className="pp-edit-btn"
                      onClick={() => {
                        setNickEdit(localProfile.nickname);
                        setEditingNickname(true);
                      }}
                    >
                      Szerkesztés
                    </button>
                  </div>
                )}
              </div>

              <div className="pp-section">
                <button
                  className="pp-dkt-btn"
                  onClick={() => OpenDKT().catch(() => {})}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  Bejelentkezés DKT-ba
                </button>
              </div>
            </div>
          )}

          {tab === "adataim" && (
            <div className="pp-tab-content">
              {detailLoading && (
                <div className="pp-loading">Adatok betöltése…</div>
              )}
              {detailError && <div className="pp-error">{detailError}</div>}
              {detail && !detailLoading && (
                <>
                  <div className="pp-section">
                    <div className="pp-section-title">Személyes adatok</div>
                    {[
                      { label: "Születésnap", value: fmtDate(detail.birthDate) },
                      { label: "Születési hely", value: detail.birthPlace },
                      { label: "Anyja neve", value: detail.mothersName },
                      {
                        label: "Iskola teljes neve",
                        value: detail.instituteName,
                      },
                      { label: "Lakcím", value: detail.address },
                    ].map(({ label, value }) => (
                      <div key={label} className="pp-data-row">
                        <span className="pp-data-label">{label}</span>
                        <span className="pp-data-value">{value || "–"}</span>
                      </div>
                    ))}
                    <div className="pp-data-row">
                      <span className="pp-data-label">
                        Jegy megjelenítési késleltetés
                      </span>
                      <span className="pp-data-value">
                        {detail.gradeDelay === 0
                          ? "Azonnal"
                          : `${detail.gradeDelay} óra`}
                      </span>
                    </div>
                  </div>

                  <div className="pp-section">
                    <div className="pp-section-title">Elérhetőség</div>
                    {[
                      { label: "E-mail cím", value: detail.email },
                      { label: "Telefonszám", value: detail.phone },
                    ].map(({ label, value }) => (
                      <div key={label} className="pp-data-row">
                        <span className="pp-data-label">{label}</span>
                        <span className="pp-data-value">{value || "–"}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "fiokok" && (
            <div className="pp-tab-content">
              <div className="pp-section">
                <div className="pp-section-title">Felhasználók</div>
                {accountsLoading && (
                  <div className="pp-loading">Betöltés…</div>
                )}
                <div className="pp-accounts-list">
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className={`pp-account-item${acc.isActive ? " active" : ""}`}
                    >
                      <div className="pp-account-avatar">
                        {acc.name
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((w) => w[0].toUpperCase())
                          .join("")}
                      </div>
                      <div className="pp-account-info">
                        <span className="pp-account-name">{acc.name}</span>
                        <span className="pp-account-role">
                          {acc.instituteName}
                        </span>
                      </div>
                      {acc.isActive ? (
                        <span className="pp-account-badge">Aktív</span>
                      ) : (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            className="pp-edit-btn"
                            onClick={() => handleSwitch(acc.id)}
                          >
                            Váltás
                          </button>
                          <button
                            className="pp-btn-cancel"
                            onClick={() => handleRemove(acc.id)}
                          >
                            Törlés
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {!accountsLoading && accounts.length === 0 && (
                    <div className="pp-loading">Nincs tárolt fiók.</div>
                  )}
                </div>
              </div>
              <div className="pp-account-actions">
                <button className="pp-logout-btn" onClick={handleLogout}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Kijelentkezés
                </button>
              </div>
            </div>
          )}
        </div>

          <div className="pp-nevjegy">
            <div className="pp-nevjegy-label">Névjegy</div>
            <button
              className="pp-nevjegy-item"
              onClick={() => setAboutModal("privacy")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <circle cx="12" cy="11" r="1" fill="currentColor"/>
                <line x1="12" y1="8" x2="12" y2="8"/>
                <path d="M12 15v-4"/>
              </svg>
              Adatvédelmi irányelvek
            </button>
            <button
              className="pp-nevjegy-item"
              onClick={() => OpenGitHub().catch(() => {})}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
              </svg>
              GitHub
            </button>
            <button
              className="pp-nevjegy-item"
              onClick={() => setAboutModal("license")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              Licenszek
            </button>
            <button
              className="pp-nevjegy-item"
              onClick={() => OpenDeveloper().catch(() => {})}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Fejlesztő
            </button>
          </div>
      </div>
    </>
  );
}
