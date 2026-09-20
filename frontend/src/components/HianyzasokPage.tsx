import { useState, useEffect } from "react";
import { GetAbsences } from "../../wailsjs/go/main/App";
import type { models } from "../../wailsjs/go/models";

const MAX_HOURS_DEFAULT = 32;

interface SubjectGroup {
  subjectName: string;
  absences: models.Absence[];
  justified: models.Absence[];
  unjustified: models.Absence[];
  usedHours: number;
  maxHours: number;
}

function groupAbsences(absences: models.Absence[]): SubjectGroup[] {
  const map = new Map<string, models.Absence[]>();
  for (const a of absences) {
    const key = a.subjectName || "Ismeretlen tárgy";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  return Array.from(map.entries())
    .map(([subjectName, list]) => {
      const sorted = list.sort((a, b) => b.date.localeCompare(a.date));
      return {
        subjectName,
        absences: sorted,
        justified:   sorted.filter((a) => a.isJustified),
        unjustified: sorted.filter((a) => !a.isJustified),
        usedHours: sorted.length,
        maxHours: MAX_HOURS_DEFAULT,
      };
    })
    .sort((a, b) => b.usedHours / b.maxHours - a.usedHours / a.maxHours);
}

function getBarColor(pct: number): string {
  if (pct >= 90) return "#ef4444";
  if (pct >= 75) return "#f97316";
  if (pct >= 51) return "#fbbf24";
  return "#4ade80";
}

function getBarClass(pct: number): string {
  if (pct >= 90) return "abs-bar-fill abs-bar-critical";
  if (pct >= 75) return "abs-bar-fill abs-bar-danger";
  if (pct >= 51) return "abs-bar-fill abs-bar-warn";
  return "abs-bar-fill abs-bar-ok";
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("hu-HU", {
      year: "numeric", month: "long", day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function AbsenceEntry({ absence }: { absence: models.Absence }) {
  return (
    <div className={`absd-entry ${absence.isJustified ? "absd-ok" : "absd-bad"}`}>
      <span className="absd-dot" />
      <div className="absd-body">
        <span className="absd-date">{fmtDate(absence.date)}</span>
        {absence.typeName && (
          <span className="absd-type">{absence.typeName}</span>
        )}
      </div>
      <span className={`absd-pill ${absence.isJustified ? "absd-pill-ok" : "absd-pill-bad"}`}>
        {absence.isJustified ? "Igazolt" : "Igazolatlan"}
      </span>
    </div>
  );
}

function SubjectRow({ group }: { group: SubjectGroup }) {
  const [open, setOpen] = useState(false);
  const pct = Math.round((group.usedHours / group.maxHours) * 100);
  const color = getBarColor(pct);
  const isCritical = pct >= 90;
  const isDanger = pct >= 75;

  const jCount = group.justified.length;
  const ujCount = group.unjustified.length;

  return (
    <div className={`abs-subject-group${isCritical ? " abs-group-critical" : ""}`}>
      <button
        className={`abs-row abs-row-btn${open ? " abs-row-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <svg
          className={`abs-chevron-svg${open ? " abs-chevron-open" : ""}`}
          width="14" height="14" viewBox="0 0 14 14" fill="none"
        >
          <path d="M4 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>

        <span className="abs-subject">{group.subjectName}</span>

        <div className="abs-bar-wrap">
          <div className="abs-bar-track">
            <div className={getBarClass(pct)} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>

        <div className="abs-meta">
          <span className="abs-count" style={{ color }}>
            {group.usedHours} / {group.maxHours} óra
          </span>
          <div className="abs-split-badges">
            {jCount > 0 && (
              <span className="abs-tag abs-tag-ok">{jCount} ig.</span>
            )}
            {ujCount > 0 && (
              <span className="abs-tag abs-tag-bad">{ujCount} ig.lan</span>
            )}
          </div>
          {isDanger && (
            <span className="abs-warn-icon" style={{ color }}>⚠</span>
          )}
        </div>
      </button>

      {open && (
        <div className="absd-panel">
          {jCount > 0 && ujCount > 0 && (
            <div className="absd-split-bar">
              <div
                className="absd-split-ok"
                style={{ width: `${Math.round((jCount / group.usedHours) * 100)}%` }}
                title={`${jCount} igazolt`}
              />
              <div
                className="absd-split-bad"
                style={{ width: `${Math.round((ujCount / group.usedHours) * 100)}%` }}
                title={`${ujCount} igazolatlan`}
              />
            </div>
          )}

          <div className="absd-section">
            {ujCount > 0 && (
              <>
                <div className="absd-section-label absd-label-bad">Igazolatlan</div>
                {group.unjustified.map((a) => (
                  <AbsenceEntry key={a.uid} absence={a} />
                ))}
              </>
            )}
            {jCount > 0 && (
              <>
                <div className="absd-section-label absd-label-ok">Igazolt</div>
                {group.justified.map((a) => (
                  <AbsenceEntry key={a.uid} absence={a} />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HianyzasokPage() {
  const [groups, setGroups] = useState<SubjectGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    GetAbsences()
      .then((raw) => { setGroups(groupAbsences(raw ?? [])); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const totalUsed = groups.reduce((s, g) => s + g.usedHours, 0);
  const totalMax = groups.reduce((s, g) => s + g.maxHours,  0);
  const totalUj = groups.reduce((s, g) => s + g.unjustified.length, 0);

  if (loading) {
    return (
      <div className="abs-page">
        <div className="abs-page-header"><h1 className="abs-page-title">Hiányzások</h1></div>
        <p style={{ color: "var(--text-secondary)", padding: "2rem" }}>Betöltés…</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="abs-page">
        <div className="abs-page-header"><h1 className="abs-page-title">Hiányzások</h1></div>
        <p style={{ color: "var(--text-secondary)", padding: "2rem" }}>Nincs rögzített hiányzás.</p>
      </div>
    );
  }

  return (
    <div className="abs-page">
      <div className="abs-page-header">
        <h1 className="abs-page-title">Hiányzások</h1>
        <div className="abs-header-badges">
          <div className="abs-total-badge">{totalUsed} / {totalMax} óra</div>
          {totalUj > 0 && (
            <div className="abs-total-badge abs-total-badge-bad">{totalUj} igazolatlan</div>
          )}
        </div>
      </div>

      <div className="abs-card">
        {groups.map((group, idx) => (
          <div key={group.subjectName}>
            {idx > 0 && <div className="abs-divider" />}
            <SubjectRow group={group} />
          </div>
        ))}
      </div>
    </div>
  );
}
