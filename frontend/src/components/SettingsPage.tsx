import { useState, useEffect } from "react";
import { SetTheme, SetCustomColor, GetCustomColor, GetBellSchedule, SetBellSchedule } from "../../wailsjs/go/main/App";
import { THEMES, THEME_NAMES, applyTheme } from "../theme";
import type { models } from "../../wailsjs/go/models";

type Section = "megjelenes" | "csengetesi-rend";

interface SettingsPageProps {
  currentTheme: string;
  onThemeChange: (name: string) => void;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export default function SettingsPage({ currentTheme, onThemeChange }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<Section>("megjelenes");
  const [customColor, setCustomColor] = useState("#2d6a4f");
  const [bellSchedule, setBellSchedule] = useState<models.BellPeriod[]>([]);
  const [bellSaved, setBellSaved] = useState(false);

  useEffect(() => {
    GetCustomColor().then((c) => { if (c) setCustomColor(c); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeSection === "csengetesi-rend") {
      GetBellSchedule()
        .then((s) => setBellSchedule(s ?? []))
        .catch(() => {});
    }
  }, [activeSection]);

  const handleTheme = (name: string) => {
    applyTheme(name);
    onThemeChange(name);
    SetTheme(name).catch(() => {});
  };

  const handleSelectEgyedi = () => {
    applyTheme("Egyedi", customColor);
    onThemeChange("Egyedi");
    SetTheme("Egyedi").catch(() => {});
    SetCustomColor(customColor).catch(() => {});
  };

  const handleCustomColor = (color: string) => {
    setCustomColor(color);
    applyTheme("Egyedi", color);
    onThemeChange("Egyedi");
    SetTheme("Egyedi").catch(() => {});
    SetCustomColor(color).catch(() => {});
  };

  const updatePeriod = (index: number, field: "start" | "end", value: string) => {
    setBellSchedule((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
    setBellSaved(false);
  };

  const addPeriod = () => {
    const nextIndex = bellSchedule.length > 0
      ? Math.max(...bellSchedule.map((p) => p.periodIndex)) + 1
      : 1;
    setBellSchedule((prev) => [...prev, { periodIndex: nextIndex, start: "08:00", end: "08:45" }]);
    setBellSaved(false);
  };

  const removePeriod = (index: number) => {
    setBellSchedule((prev) => prev.filter((_, i) => i !== index));
    setBellSaved(false);
  };

  const saveBellSchedule = () => {
    const sorted = [...bellSchedule].sort((a, b) => a.periodIndex - b.periodIndex);
    SetBellSchedule(sorted)
      .then(() => {
        setBellSchedule(sorted);
        setBellSaved(true);
        setTimeout(() => setBellSaved(false), 2000);
      })
      .catch(() => {});
  };

  const resetBellSchedule = () => {
    SetBellSchedule([])
      .then(() => {
        setBellSchedule([]);
        setBellSaved(true);
        setTimeout(() => setBellSaved(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <div className="settings-page">
      <aside className="settings-sidebar">
        <button
          className={`settings-nav-item${activeSection === "megjelenes" ? " active" : ""}`}
          onClick={() => setActiveSection("megjelenes")}
        >
          Megjelenés
        </button>
        <button
          className={`settings-nav-item${activeSection === "csengetesi-rend" ? " active" : ""}`}
          onClick={() => setActiveSection("csengetesi-rend")}
        >
          Csengetési rend
        </button>
      </aside>

      <div className="settings-content">
        {activeSection === "megjelenes" && (
          <section className="settings-section">
            <h2 className="settings-section-title">Megjelenés</h2>

            <div className="settings-card">
              <div className="settings-field-label">Színtéma</div>
              <div className="theme-swatches">
                {THEME_NAMES.map((name) => {
                  const theme = THEMES[name];
                  const isActive = name === currentTheme;
                  return (
                    <button
                      key={name}
                      className={`theme-swatch-btn${isActive ? " active" : ""}`}
                      onClick={() => handleTheme(name)}
                      title={name}
                    >
                      <span
                        className="theme-swatch-circle"
                        style={{ background: theme.primary }}
                      />
                      <span className="theme-swatch-label">{name}</span>
                    </button>
                  );
                })}
                <button
                  className={`theme-swatch-btn${currentTheme === "Egyedi" ? " active" : ""}`}
                  onClick={handleSelectEgyedi}
                  title="Egyedi"
                >
                  <span
                    className="theme-swatch-circle theme-swatch-custom"
                    style={currentTheme === "Egyedi" ? { background: customColor } : undefined}
                  />
                  <span className="theme-swatch-label">Egyedi</span>
                </button>
              </div>

              {currentTheme === "Egyedi" && (
                <div className="custom-theme-panel">
                  <div className="settings-field-label">Fő szín</div>
                  <div className="custom-color-row">
                    <label className="custom-color-swatch-wrap">
                      <input
                        type="color"
                        className="custom-color-native"
                        value={customColor}
                        onChange={(e) => handleCustomColor(e.target.value)}
                      />
                      <span
                        className="custom-color-swatch"
                        style={{ background: customColor }}
                      />
                    </label>
                    <span className="custom-color-hex">{customColor.toUpperCase()}</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {activeSection === "csengetesi-rend" && (
          <section className="settings-section">
            <h2 className="settings-section-title">Csengetési rend</h2>

            <div className="settings-card">
              <div className="settings-field-label">Egyéni csengetési rend</div>
              <p className="bell-schedule-hint">
                Ha a Kréta nem tartalmazza a helyes időpontokat, itt megadhatod az iskolád csengetési rendjét.
                Az órarendben ezek az időpontok jelennek meg a Kréta adatok helyett.
              </p>

              {bellSchedule.length === 0 ? (
                <div className="bell-empty">
                  Nincs egyéni csengetési rend beállítva — a Kréta időpontjai használatosak.
                </div>
              ) : (
                <div className="bell-table">
                  <div className="bell-table-head">
                    <span>Óra</span>
                    <span>Kezdés</span>
                    <span>Vége</span>
                    <span></span>
                  </div>
                  {bellSchedule.map((period, i) => (
                    <div key={i} className="bell-table-row">
                      <span className="bell-period-num">{period.periodIndex}.</span>
                      <input
                        type="time"
                        className="bell-time-input"
                        value={period.start}
                        onChange={(e) => updatePeriod(i, "start", e.target.value)}
                      />
                      <input
                        type="time"
                        className="bell-time-input"
                        value={period.end}
                        onChange={(e) => updatePeriod(i, "end", e.target.value)}
                      />
                      <button
                        className="bell-remove-btn"
                        onClick={() => removePeriod(i)}
                        title="Törlés"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="bell-actions">
                <button className="bell-add-btn" onClick={addPeriod}>
                  + Óra hozzáadása
                </button>
                <div style={{ flex: 1 }} />
                {bellSchedule.length > 0 && (
                  <button className="bell-reset-btn" onClick={resetBellSchedule}>
                    Visszaállítás
                  </button>
                )}
                <button
                  className={`bell-save-btn${bellSaved ? " saved" : ""}`}
                  onClick={saveBellSchedule}
                >
                  {bellSaved ? "Mentve" : "Mentés"}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
