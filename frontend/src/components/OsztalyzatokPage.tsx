import { useState, useEffect, useRef } from "react";
import { GetGrades, ExportGradesCSV, ExportGradesPDF } from "../../wailsjs/go/main/App";
import type { Grade } from "../types/kreta";
import { markSync } from "../utils/sync";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

type PeriodKey = "1w" | "2w" | "1m" | "3m";

const PERIODS: { key: PeriodKey; label: string; days: number }[] = [
  { key: "1w", label: "Hetes", days: 7 },
  { key: "2w", label: "2 hetes", days: 14 },
  { key: "1m", label: "Havi", days: 30 },
  { key: "3m", label: "3 hónapos", days: 90 },
];

const GRADE_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  5: { bg: "rgba(74,222,128,.15)", border: "rgba(74,222,128,.4)",  text: "#4ade80" },
  4: { bg: "rgba(134,239,172,.12)", border: "rgba(134,239,172,.35)", text: "#86efac" },
  3: { bg: "rgba(251,191,36,.12)", border: "rgba(251,191,36,.35)",  text: "#fbbf24" },
  2: { bg: "rgba(249,115,22,.12)", border: "rgba(249,115,22,.35)",  text: "#f97316" },
  1: { bg: "rgba(239,68,68,.12)", border: "rgba(239,68,68,.35)",   text: "#ef4444" },
};

function gradeColor(g: number) {
  return GRADE_COLORS[g] ?? GRADE_COLORS[3];
}

function fmtAvg(n: number) {
  return isNaN(n) ? "–" : n.toFixed(2);
}

function weightedAvg(grades: Grade[]): number {
  const meaningful = grades.filter((g) => g.value > 0);
  if (meaningful.length === 0) return NaN;
  const totalWeight = meaningful.reduce((s, g) => s + (g.weight || 100), 0);
  const totalVal = meaningful.reduce((s, g) => s + g.value * (g.weight || 100), 0);
  return totalVal / totalWeight;
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

interface SubjectGroup {
  name: string;
  teacher: string;
  grades: Grade[];
  semesterGrades: Grade[];
  yearEndGrades: Grade[];
}

function groupBySubject(grades: Grade[]): SubjectGroup[] {
  const map = new Map<string, SubjectGroup>();
  for (const g of grades) {
    if (g.value <= 0) continue;
    const key = g.subjectUid || g.subjectName;
    if (!map.has(key)) {
      map.set(key, { name: g.subjectName, teacher: g.teacher, grades: [], semesterGrades: [], yearEndGrades: [] });
    }
    const grp = map.get(key)!;
    if (g.teacher && !grp.teacher) grp.teacher = g.teacher;
    if (g.typeUid?.includes("felevi_jegy")) grp.semesterGrades.push(g);
    else if (g.typeUid?.includes("evvegi_jegy")) grp.yearEndGrades.push(g);
    else grp.grades.push(g);
  }
  return Array.from(map.values())
    .filter((s) => s.grades.length > 0 || s.semesterGrades.length > 0 || s.yearEndGrades.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "hu"));
}

function GradeChip({ grade }: { grade: Grade }) {
  const c = gradeColor(grade.value);
  return (
    <div
      className="oz-chip"
      style={{ backgroundColor: c.bg, borderColor: c.border }}
      title={`${grade.value} – ${grade.typeName}${grade.topic ? ` (${grade.topic})` : ""}`}
    >
      <span className="oz-chip-num" style={{ color: c.text }}>{grade.value}</span>
      <span className="oz-chip-topic">{grade.topic || grade.typeName}</span>
      <span className="oz-chip-type">{fmtDate(grade.date)}</span>
    </div>
  );
}

function OfficialBadge({ grade, label }: { grade: Grade; label: string }) {
  const c = gradeColor(grade.value);
  return (
    <div className="oz-official-grade oz-og-semester">
      <span className="oz-og-label">{label}</span>
      <span className="oz-og-val" style={{ color: c.text, borderColor: c.border, backgroundColor: c.bg }}>
        {grade.value}
      </span>
    </div>
  );
}

function SubjectCard({ subject, expanded, onToggle }: { subject: SubjectGroup; expanded: boolean; onToggle: () => void }) {
  const avg = weightedAvg(subject.grades);
  const avgC = gradeColor(Math.round(avg));

  return (
    <div className={`oz-subject-card${expanded ? " expanded" : ""}`}>
      <button className="oz-subject-header" onClick={onToggle}>
        <div className="oz-sh-left">
          <span className="oz-sh-name">{subject.name}</span>
          <span className="oz-sh-teacher">{subject.teacher}</span>
        </div>
        <div className="oz-sh-right">
          {subject.grades.length > 0 && (
            <div className="oz-sh-avg">
              <span className="oz-sh-avg-num" style={{ color: avgC.text }}>{fmtAvg(avg)}</span>
              <span className="oz-sh-avg-label">átlag</span>
            </div>
          )}
          {subject.semesterGrades.map((sg) => (
            <div key={sg.uid} className="oz-sh-official">
              <span className="oz-sh-off-label">Félévi</span>
              <span className="oz-sh-off-val" style={{ color: gradeColor(sg.value).text }}>{sg.value}</span>
            </div>
          ))}
          {subject.yearEndGrades.map((yg) => (
            <div key={yg.uid} className="oz-sh-official oz-sh-yearend">
              <span className="oz-sh-off-label">Év végi</span>
              <span className="oz-sh-off-val" style={{ color: gradeColor(yg.value).text }}>{yg.value}</span>
            </div>
          ))}
          <span className="oz-sh-toggle">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>
      {expanded && (
        <div className="oz-subject-body">
          {subject.grades.length === 0 ? (
            <p className="oz-no-grades">Nincs évközi jegy</p>
          ) : (
            <div className="oz-month-chips">
              {[...subject.grades]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((g) => <GradeChip key={g.uid} grade={g} />)}
            </div>
          )}
          {subject.semesterGrades.map((sg) => <OfficialBadge key={sg.uid} grade={sg} label="Félévi jegy" />)}
          {subject.yearEndGrades.map((yg) => <OfficialBadge key={yg.uid} grade={yg} label="Év végi jegy" />)}
        </div>
      )}
    </div>
  );
}

function getSemesterKey(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  if (month >= 9) return `${year}/${String(year + 1).slice(-2)} ősz`;
  if (month <= 6) return `${year - 1}/${String(year).slice(-2)} tavasz`;
  return `${year} nyár`;
}

function getSemesterOrder(key: string): number {
  const parts = key.split(" ");
  const startYear = parseInt(parts[0].split("/")[0]);
  return startYear * 10 + (parts[1] === "ősz" ? 1 : 2);
}

const SUBJECT_PALETTE = [
  "#5e8fa0", "#a07840", "#8f5e90", "#5e906e",
  "#8f8f40", "#5e6090", "#905e60", "#408f90",
];

function cssVar(name: string, fb = ""): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;
}

function buildTrendData(subjects: SubjectGroup[]) {
  const semSet = new Set<string>();
  subjects.forEach((s) => s.grades.filter((g) => g.value > 0).forEach((g) => semSet.add(getSemesterKey(g.date))));
  const semesters = [...semSet].sort((a, b) => getSemesterOrder(a) - getSemesterOrder(b));
  if (semesters.length === 0) return { data: [], semesters };

  const data = semesters.map((sem) => {
    const row: Record<string, number | string> = { semester: sem };
    let totalVal = 0;
    let totalW = 0;
    subjects.forEach((s) => {
      const sg = s.grades.filter((g) => g.value > 0 && getSemesterKey(g.date) === sem);
      if (sg.length > 0) {
        row[s.name] = Math.round(weightedAvg(sg) * 100) / 100;
        sg.forEach((g) => { totalVal += g.value * (g.weight || 100); totalW += g.weight || 100; });
      }
    });
    if (totalW > 0) row["__overall__"] = Math.round((totalVal / totalW) * 100) / 100;
    return row;
  });

  return { data, semesters };
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="trend-tooltip">
      <div className="trend-tt-label">{label}</div>
      {[...payload].reverse().map((p: any) => (
        <div key={p.dataKey} className="trend-tt-row">
          <span className="trend-tt-dot" style={{ background: p.color }} />
          <span className="trend-tt-name">{p.dataKey === "__overall__" ? "Összesített" : p.dataKey}</span>
          <span className="trend-tt-val">{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ subjects }: { subjects: SubjectGroup[] }) {
  const activeSubjects = subjects.filter((s) => s.grades.some((g) => g.value > 0));
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const { data, semesters } = buildTrendData(activeSubjects);

  const accentBright  = cssVar("--accent-bright", "#a3c940");
  const textDim       = cssVar("--text-dim",       "#6a8860");
  const cardBgSubtle  = cssVar("--card-bg-subtle", "#1a2620");

  if (semesters.length === 0) return null;

  const toggle = (name: string) =>
    setHidden((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

  return (
    <div className="trend-card">
      <div className="trend-title">Átlagtrendek</div>
      <div className="trend-legend">
        {activeSubjects.map((s, i) => (
          <button
            key={s.name}
            className={`trend-chip${hidden.has(s.name) ? " dim" : ""}`}
            style={{ borderColor: SUBJECT_PALETTE[i % SUBJECT_PALETTE.length] + "99" }}
            onClick={() => toggle(s.name)}
          >
            <span className="trend-chip-dot" style={{ background: SUBJECT_PALETTE[i % SUBJECT_PALETTE.length] }} />
            {s.name}
          </button>
        ))}
        <button
          className={`trend-chip trend-chip-overall${hidden.has("__overall__") ? " dim" : ""}`}
          onClick={() => toggle("__overall__")}
        >
          <span className="trend-chip-dot" style={{ background: accentBright }} />
          Összesített
        </button>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 5, left: -20 }}>
          <XAxis
            dataKey="semester"
            tick={{ fill: textDim, fontSize: 11 }}
            axisLine={{ stroke: cardBgSubtle }}
            tickLine={false}
          />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fill: textDim, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine y={2} stroke={cardBgSubtle} strokeDasharray="4 3" />
          <ReferenceLine y={3} stroke={cardBgSubtle} strokeDasharray="4 3" />
          <ReferenceLine y={4} stroke={cardBgSubtle} strokeDasharray="4 3" />
          <ReferenceLine y={5} stroke={cardBgSubtle} strokeDasharray="4 3" />
          <Tooltip content={<TrendTooltip />} />
          {activeSubjects.map((s, i) =>
            hidden.has(s.name) ? null : (
              <Line
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={SUBJECT_PALETTE[i % SUBJECT_PALETTE.length]}
                strokeWidth={1.5}
                dot={{ fill: SUBJECT_PALETTE[i % SUBJECT_PALETTE.length], r: 3, strokeWidth: 0 }}
                connectNulls
              />
            )
          )}
          {!hidden.has("__overall__") && (
            <Line
              type="monotone"
              dataKey="__overall__"
              stroke={accentBright}
              strokeWidth={2.5}
              dot={{ fill: accentBright, r: 4, strokeWidth: 0 }}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}


export default function OsztalyzatokPage({ themeKey: _ }: { themeKey?: string }) {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [exportOpen, setExportOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("1m");
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    GetGrades()
      .then((gs) => { setGrades(gs ?? []); markSync(); })
      .catch((e: any) => setError(typeof e === "string" ? e : e?.message ?? "Betöltési hiba"))
      .finally(() => setLoading(false));
  }, []);

  const subjects = groupBySubject(grades);
  const allExpanded = subjects.every((s) => expanded[s.name]);

  const toggle = (name: string) =>
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));

  const toggleAll = () =>
    setExpanded(Object.fromEntries(subjects.map((s) => [s.name, !allExpanded])));

  const meaningfulGrades = grades.filter((g) => g.value > 0 && !g.typeUid?.includes("jegy_ertekeles"));
  const yearGrades = grades.filter((g) => g.typeUid?.includes("evvegi_jegy"));

  const overallAvg = weightedAvg(meaningfulGrades);
  const yearAvg = yearGrades.length > 0 ? yearGrades.reduce((s, g) => s + g.value, 0) / yearGrades.length : NaN;

  const selectedPeriod = PERIODS.find((p) => p.key === period)!;
  const periodCutoff = new Date();
  periodCutoff.setDate(periodCutoff.getDate() - selectedPeriod.days);
  const periodGrades = meaningfulGrades.filter((g) => new Date(g.date) >= periodCutoff);
  const periodAvg = weightedAvg(periodGrades);

  return (
    <div className="oz-page">
      {loading && (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
          Betöltés…
        </div>
      )}
      {error && <div style={{ padding: "1rem", color: "#ef4444" }}>{error}</div>}

      {!loading && !error && (
        <>
          <section className="oz-summary">
            {meaningfulGrades.length > 0 && (
              <div className="oz-stat-card oz-stat-card-accent">
                <div className="oz-stat-label">Éves átlag</div>
                <div className="oz-stat-val" style={{ color: gradeColor(Math.round(overallAvg)).text }}>{fmtAvg(overallAvg)}</div>
                <div className="oz-stat-sub">{meaningfulGrades.length} jegy, súlyozással</div>
              </div>
            )}
            {!isNaN(yearAvg) && (
              <div className="oz-stat-card">
                <div className="oz-stat-label">Év végi tantárgyi átlag</div>
                <div className="oz-stat-val" style={{ color: gradeColor(Math.round(yearAvg)).text }}>{fmtAvg(yearAvg)}</div>
                <div className="oz-stat-sub">{yearGrades.length} tantárgyból</div>
              </div>
            )}
            {meaningfulGrades.length > 0 && (
              <div className="oz-stat-card">
                <div className="oz-stat-label">Időszaki átlag</div>
                <div className="oz-period-tabs">
                  {PERIODS.map((p) => (
                    <button
                      key={p.key}
                      className={`oz-period-tab${period === p.key ? " active" : ""}`}
                      onClick={() => setPeriod(p.key)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="oz-stat-val" style={{ color: isNaN(periodAvg) ? "var(--text-faint)" : gradeColor(Math.round(periodAvg)).text }}>
                  {fmtAvg(periodAvg)}
                </div>
                <div className="oz-stat-sub">{periodGrades.length} jegy az utolsó {selectedPeriod.days} napból</div>
              </div>
            )}
          </section>

          <div className="oz-list-header">
            <h2 className="oz-list-title">Tantárgyak</h2>
            <div className="oz-list-actions">
              {subjects.length > 0 && (
                <button className="oz-toggle-all-btn" onClick={toggleAll}>
                  {allExpanded ? "Becsukás mind ▲" : "Kinyitás mind ▼"}
                </button>
              )}
              {grades.length > 0 && (
                <div className="oz-export-wrap" ref={exportRef}>
                  <button className="oz-export-btn" onClick={() => setExportOpen((o) => !o)}>
                    Exportálás ▾
                  </button>
                  {exportOpen && (
                    <div className="oz-export-menu">
                      <button
                        className="oz-export-item"
                        onClick={() => { setExportOpen(false); ExportGradesCSV().catch(() => {}); }}
                      >
                        Mentés CSV-be
                      </button>
                      <button
                        className="oz-export-item"
                        onClick={() => { setExportOpen(false); ExportGradesPDF().catch(() => {}); }}
                      >
                        Mentés PDF-be
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {subjects.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
              Nincs bejegyzett jegy.
            </div>
          ) : (
            <div className="oz-subjects">
              {subjects.map((s) => (
                <SubjectCard key={s.name} subject={s} expanded={!!expanded[s.name]} onToggle={() => toggle(s.name)} />
              ))}
            </div>
          )}

          {subjects.length > 0 && (
            <div className="oz-extras">
              <TrendChart subjects={subjects} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
