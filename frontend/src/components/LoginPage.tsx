import { useState, useEffect, useRef, useCallback } from "react";
import { SearchInstitutes, Login } from "../../wailsjs/go/main/App";
import { models } from "../../wailsjs/go/models";
import type { AccountInfo } from "../types/kreta";

interface Props {
onLogin: (account: AccountInfo) => void;
}

export default function LoginPage({ onLogin }: Props) {
const [step, setStep] = useState<"school" | "credentials">("school");

const [query, setQuery] = useState("");
const [results, setResults] = useState<models.Institute[]>([]);
const [searching, setSearching] = useState(false);
const [searchError, setSearchError] = useState<string | null>(null);

const [selected, setSelected] = useState<models.Institute | null>(null);
const [dropdownOpen, setDropdownOpen] = useState(false);
const [highlightIdx, setHighlightIdx] = useState(0);

const [username, setUsername] = useState("");
const [password, setPassword] = useState("");
const [showPassword, setShowPassword] = useState(false);

const [loggingIn, setLoggingIn] = useState(false);
const [loginError, setLoginError] = useState<string | null>(null);

const inputRef = useRef<HTMLInputElement>(null);
const dropdownRef = useRef<HTMLDivElement>(null);
const usernameRef = useRef<HTMLInputElement>(null);
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

/*

* Iskolakeresés
* 
* Az iskola kiválasztása továbbra is megmarad a meglévő UI-ban,
* mert az e-llenorzo többi része az Institute objektumot használja
* az account létrehozásakor.
* 
* Maga az ÚjKréta autentikáció azonban nem itt történik:
* a Login() Wails backend metódus intézi a
* 
* POST /connect/token
* 
* password grantet.
  */
  useEffect(() => {
  if (debounceRef.current) {
  clearTimeout(debounceRef.current);
  }

const trimmed = query.trim();

if (trimmed.length < 2) {
  setResults([]);
  setDropdownOpen(false);
  setSearchError(null);
  return;
}

debounceRef.current = setTimeout(async () => {
  setSearching(true);
  setSearchError(null);

  try {
    const list = await SearchInstitutes(trimmed);

    setResults(list ?? []);
    setHighlightIdx(0);
    setDropdownOpen(true);
  } catch (err: unknown) {
    const msg =
      typeof err === "string"
        ? err
        : err instanceof Error
          ? err.message
          : String(err);

    console.error(
      "[LoginPage] SearchInstitutes failed:",
      msg
    );

    setSearchError(`Keresési hiba: ${msg}`);
    setResults([]);
  } finally {
    setSearching(false);
  }
}, 400);

return () => {
  if (debounceRef.current) {
    clearTimeout(debounceRef.current);
  }
};

}, [query]);

/*

* Amikor átlépünk a hitelesítési képernyőre,
* automatikusan a felhasználónév mező kapja a fókuszt.
  */
  useEffect(() => {
  if (step !== "credentials") {
  return;
  }

const timer = setTimeout(() => {
  usernameRef.current?.focus();
}, 80);

return () => clearTimeout(timer);

}, [step]);

/*

* Dropdown bezárása kattintáskor.
  */
  useEffect(() => {
  function onPointerDown(e: PointerEvent) {
  const target = e.target as Node;
  
  if (
  inputRef.current?.contains(target) ||
  dropdownRef.current?.contains(target)
  ) {
  return;
  }
  
  setDropdownOpen(false);
  }

document.addEventListener("pointerdown", onPointerDown);

return () => {
  document.removeEventListener(
    "pointerdown",
    onPointerDown
  );
};

}, []);

const pickSchool = useCallback(
(inst: models.Institute) => {
setSelected(inst);
setQuery(inst.instituteName);
setDropdownOpen(false);
setSearchError(null);
},
[]
);

function handleSchoolKeyDown(
e: React.KeyboardEvent<HTMLInputElement>
) {
if (!dropdownOpen || results.length === 0) {
return;
}

switch (e.key) {
  case "ArrowDown":
    e.preventDefault();

    setHighlightIdx((i) =>
      Math.min(i + 1, results.length - 1)
    );

    break;

  case "ArrowUp":
    e.preventDefault();

    setHighlightIdx((i) =>
      Math.max(i - 1, 0)
    );

    break;

  case "Enter":
    e.preventDefault();

    if (results[highlightIdx]) {
      pickSchool(results[highlightIdx]);
    }

    break;

  case "Escape":
    e.preventDefault();
    setDropdownOpen(false);
    break;
}

}

/*

* ÚjKréta bejelentkezés.
* 
* FONTOS:
* A frontend nem hívja közvetlenül a /connect/token endpointot.
* 
* A Wails Login() metódus:
* 
* frontend
*   ↓
* Wails Login()
*   ↓
* backend/kreta/auth.go
*   ↓
* POST /connect/token
* 
* Így az API-kommunikáció egy helyen marad.
  */
  async function handleLogin() {
  if (!selected) {
  setLoginError("Válaszd ki az iskoládat.");
  return;
  }

const trimmedUsername = username.trim();

if (!trimmedUsername) {
  setLoginError("Add meg a felhasználóneved.");
  usernameRef.current?.focus();
  return;
}

if (!password) {
  setLoginError("Add meg a jelszavad.");
  return;
}

if (loggingIn) {
  return;
}

setLoggingIn(true);
setLoginError(null);

try {
  /*
   * A Login() backend metódus az ÚjKréta
   * password grant autentikációját végzi.
   */
  const account = await Login(
    selected,
    trimmedUsername,
    password
  );

  if (!account) {
    throw new Error(
      "A szerver nem adott vissza felhasználói fiókot."
    );
  }

  /*
   * A backend sikeres autentikáció után létrehozza
   * az AccountInfo objektumot.
   */
  onLogin({
    id: account.id,
    name: account.name,
    username: account.username,
    instituteCode: account.instituteCode,
    instituteName: account.instituteName,
    isActive: account.isActive,
  });
} catch (err: unknown) {
  const msg =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : String(err);

  /*
   * Az auth.go már magyar, felhasználóbarát OAuth hibát
   * ad vissza, ezért azt változtatás nélkül megjelenítjük.
   */
  setLoginError(
    msg || "Sikertelen bejelentkezés."
  );
} finally {
  setLoggingIn(false);
}

}

function handleBack() {
if (loggingIn) {
return;
}

setStep("school");
setLoginError(null);

}

function handleSchoolClear() {
setQuery("");
setSelected(null);
setResults([]);
setDropdownOpen(false);
setSearchError(null);

requestAnimationFrame(() => {
  inputRef.current?.focus();
});

}

return (
<div className="lg-screen">
<div className="lg-card">
<div className="lg-logo">
<span className="lg-logo-mark">T</span>
<span className="lg-logo-name">Toll</span>
</div>

    {step === "school" && (
      <div className="lg-step">
        <p className="lg-step-title">
          Válaszd ki az iskoládat
        </p>

        <p className="lg-step-sub">
          Írj be legalább 2 betűt a kereséshez
        </p>

        {searchError && (
          <div className="lg-error-box">
            {searchError}
          </div>
        )}

        <div className="lg-school-wrap">
          <div
            className={`lg-field-row${
              searching
                ? " lg-field-loading"
                : ""
            }`}
          >
            <span className="lg-field-icon">
              {searching ? "⏳" : "🏫"}
            </span>

            <input
              ref={inputRef}
              className="lg-input"
              type="text"
              placeholder="Iskola neve vagy intézménykód…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
                setSearchError(null);
              }}
              onFocus={() => {
                if (results.length > 0) {
                  setDropdownOpen(true);
                }
              }}
              onKeyDown={handleSchoolKeyDown}
              autoComplete="off"
              spellCheck={false}
              disabled={searching && false}
            />

            {query && !searching && (
              <button
                type="button"
                className="lg-clear-btn"
                tabIndex={-1}
                onClick={handleSchoolClear}
                aria-label="Keresés törlése"
              >
                ✕
              </button>
            )}
          </div>

          {dropdownOpen && (
            <div
              ref={dropdownRef}
              className="lg-dropdown"
            >
              {results.length > 0 ? (
                results.map((inst, i) => (
                  <button
                    type="button"
                    key={inst.instituteCode}
                    className={[
                      "lg-option",
                      i === highlightIdx
                        ? "highlighted"
                        : "",
                      selected?.instituteCode ===
                      inst.instituteCode
                        ? "selected"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onMouseDown={() =>
                      pickSchool(inst)
                    }
                    onMouseEnter={() =>
                      setHighlightIdx(i)
                    }
                  >
                    <span className="lg-option-name">
                      {inst.instituteName}
                    </span>

                    {inst.city && (
                      <span className="lg-option-city">
                        {inst.city}
                      </span>
                    )}
                  </button>
                ))
              ) : (
                !searching && (
                  <div className="lg-no-results">
                    Nincs találat a(z) „{query}”
                    keresésre
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {selected && (
          <div className="lg-selected-badge">
            <span className="lg-selected-icon">
              ✓
            </span>

            <span className="lg-selected-text">
              {selected.instituteName}

              {selected.city
                ? ` — ${selected.city}`
                : ""}
            </span>
          </div>
        )}

        <button
          type="button"
          className="lg-submit-btn"
          disabled={!selected}
          onClick={() =>
            setStep("credentials")
          }
        >
          Következő
        </button>
      </div>
    )}

    {step === "credentials" && selected && (
      <div className="lg-step">
        <button
          type="button"
          className="lg-back-btn"
          onClick={handleBack}
          disabled={loggingIn}
        >
          ← Vissza
        </button>

        <div className="lg-school-pill">
          <span className="lg-school-pill-icon">
            🏫
          </span>

          <span className="lg-school-pill-name">
            {selected.instituteName}
          </span>

          {selected.city && (
            <span className="lg-school-pill-city">
              {selected.city}
            </span>
          )}
        </div>

        <p className="lg-step-title">
          Bejelentkezés
        </p>

        <p className="lg-step-sub">
          Az ÚjKréta-fiókod felhasználónevével és
          jelszavával
        </p>

        {loginError && (
          <div className="lg-error-box">
            {loginError}
          </div>
        )}

        <div className="lg-fields">
          <div className="lg-field">
            <label
              className="lg-label"
              htmlFor="kreta-username"
            >
              Felhasználónév
            </label>

            <div className="lg-field-row">
              <span className="lg-field-icon">
                👤
              </span>

              <input
                ref={usernameRef}
                id="kreta-username"
                className="lg-input"
                type="text"
                placeholder="pl. kovacs.janos"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setLoginError(null);
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !loggingIn
                  ) {
                    void handleLogin();
                  }
                }}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={loggingIn}
              />
            </div>
          </div>

          <div className="lg-field">
            <label
              className="lg-label"
              htmlFor="kreta-password"
            >
              Jelszó
            </label>

            <div className="lg-field-row">
              <span className="lg-field-icon">
                🔒
              </span>

              <input
                id="kreta-password"
                className="lg-input"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                placeholder="Kréta jelszó"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLoginError(null);
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !loggingIn
                  ) {
                    void handleLogin();
                  }
                }}
                autoComplete="current-password"
                disabled={loggingIn}
              />

              <button
                type="button"
                className="lg-pw-toggle"
                tabIndex={-1}
                onClick={() =>
                  setShowPassword(
                    (value) => !value
                  )
                }
                title={
                  showPassword
                    ? "Jelszó elrejtése"
                    : "Jelszó megjelenítése"
                }
                aria-label={
                  showPassword
                    ? "Jelszó elrejtése"
                    : "Jelszó megjelenítése"
                }
                disabled={loggingIn}
              >
                {showPassword
                  ? "🫣"
                  : "👁"}
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="lg-submit-btn"
          disabled={
            !username.trim() ||
            !password ||
            loggingIn
          }
          onClick={() => void handleLogin()}
        >
          {loggingIn ? (
            <span className="lg-spinner-row">
              <span className="lg-spinner" />
              Bejelentkezés…
            </span>
          ) : (
            "Bejelentkezés"
          )}
        </button>
      </div>
    )}
  </div>

  <p className="lg-footer-note">
    Ez az alkalmazás nem áll kapcsolatban az
    e-Kréta Zrt.-vel.
  </p>
</div>

);
}