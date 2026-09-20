import { useState, useEffect } from "react";
import { GetTimetable, GetBellSchedule, ExportTimetableICS } from "../../wailsjs/go/main/App";
import type { Lesson, BellPeriod } from "../types/kreta";

type ViewMode = "weekdays" | "weekdays-sat" | "full-week";

const VIEW_MODES: { id: ViewMode; label: string; extraDays: number }[] = [
  { id: "weekdays", label: "Csak munkanapok", extraDays: 4 },
  { id: "weekdays-sat", label: "Munkanapok + szombat", extraDays: 5 },
  { id: "full-week", label: "Egész hét", extraDays: 6 },
];

const DAY_NAMES = [
  "Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap",
];

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekMonday(d: Date): Date {
  const copy = new Date(d);
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function fmtTime(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("hu-HU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtWeekLabel(monday: Date, extraDays: number): string {
  const end = new Date(monday);
  end.setDate(monday.getDate() + extraDays);
  return (
    monday.toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) +
    " – " +
    end.toLocaleDateString("hu-HU", { month: "short", day: "numeric" })
  );
}

function lessonLocalDate(iso: string): string {
  if (!iso) return "";
  try {
    return toISO(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function LessonModal({ lesson, onClose }: { lesson: Lesson; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const rows = [
    { label: "Tantárgy", value: lesson.subjectName },
    { label: "Tanár", value: lesson.teacher },
    lesson.substituteTeacher
        ? { label: "Helyettes tanár", value: lesson.substituteTeacher }
        : null,
    { label: "Terem", value: lesson.room },
    lesson.substituteTeacher
      ? { label: "Eredeti tanár", value: lesson.teacher }
      : null,
    {
      label: "Időpont",
      value: `${fmtTime(lesson.start)} – ${fmtTime(lesson.end)}`,
    },
    lesson.yearIndex
      ? { label: "Éves sorszám", value: `${lesson.yearIndex}. óra` }
      : null,
    lesson.description
      ? { label: "Téma", value: lesson.description }
      : null,
    lesson.groupName
      ? { label: "Csoport", value: lesson.groupName }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <>
      <div className="hz-backdrop" onClick={onClose} />
      <div className="hz-modal" role="dialog" aria-modal="true">
        <div className="hz-modal-head">
          <span className="hz-modal-subject-tag">
            {lesson.subjectName || lesson.name}
          </span>
          <button className="hz-modal-close" onClick={onClose} aria-label="Bezárás">
            ✕
          </button>
        </div>
        <h2 className="hz-modal-title">
          {lesson.periodIndex}. óra
          {lesson.isCancelled ? " — ELMARAD" : ""}
        </h2>
        {lesson.isCancelled && (
            <div className="tt-cancelled-notice">
              Ez az óra elmarad.
            </div>
        )}
        {lesson.substituteTeacher && (
            <div className="tt-substitution-notice">
              Helyettesítés:{" "}
              <span className="tt-original-teacher">{lesson.teacher || "Eredeti tanár"}</span>
              {" → "}
              <span className="tt-substitute-teacher">{lesson.substituteTeacher}</span>
            </div>
        )}
        <div className="hz-modal-meta">
          {rows.map((row) => (
            <div key={row.label} className="hz-meta-row">
              <span className="hz-meta-label">{row.label}</span>
              <span className="hz-meta-value">{row.value || "–"}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

interface DayColumn {
  date: string;
  dayName: string;
  shortDate: string;
  isToday: boolean;
  lessons: Lesson[];
}

function todayISO(): string {
  return toISO(new Date());
}

function customTimeToMs(date: string, time: string): number {
  return new Date(`${date}T${time}:00`).getTime();
}

export default function OrarendPage() {
  const [mode, setMode] = useState<ViewMode>("weekdays");
  const [monday, setMonday] = useState(() => weekMonday(new Date()));
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Lesson | null>(null);
  const [bellSchedule, setBellSchedule] = useState<BellPeriod[]>([]);

  useEffect(() => {
    GetBellSchedule().then((s) => setBellSchedule(s ?? [])).catch(() => {});
  }, []);

  const extraDays = VIEW_MODES.find((v) => v.id === mode)!.extraDays;

  useEffect(() => {
    const apiEnd = new Date(monday);
    apiEnd.setDate(monday.getDate() + extraDays + 1);

    setLoading(true);
    setError(null);
    GetTimetable(toISO(monday), toISO(apiEnd))
      .then((ls) => setLessons(ls ?? []))
      .catch((e: any) =>
        setError(typeof e === "string" ? e : e?.message ?? "Betöltési hiba")
      )
      .finally(() => setLoading(false));
  }, [monday, extraDays]);

  const today = todayISO();

  const bellMap = new Map<number, BellPeriod>(
    bellSchedule.map((p) => [p.periodIndex, p])
  );

  const columns: DayColumn[] = Array.from({ length: extraDays + 1 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = toISO(d);
    return {
      date: iso,
      dayName: DAY_NAMES[i],
      shortDate: `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`,
      isToday: iso === today,
      lessons: lessons
        .filter((l) => lessonLocalDate(l.date || l.start) === iso)
        .sort((a, b) => a.start.localeCompare(b.start)),
    };
  });

  const allPeriods = [
    ...new Set(
      columns.flatMap((col) => col.lessons.map((l) => l.periodIndex))
    ),
  ]
    .filter((p) => p > 0)
    .sort((a, b) => a - b);

  const sampleByPeriod = new Map<number, Lesson>();
  for (const col of columns) {
    for (const l of col.lessons) {
      if (!sampleByPeriod.has(l.periodIndex)) {
        sampleByPeriod.set(l.periodIndex, l);
      }
    }
  }

  const prevWeek = () => {
    const d = new Date(monday);
    d.setDate(d.getDate() - 7);
    setMonday(d);
  };
  const nextWeek = () => {
    const d = new Date(monday);
    d.setDate(d.getDate() + 7);
    setMonday(d);
  };
  const goToday = () => setMonday(weekMonday(new Date()));

  const isCurrentWeek = toISO(weekMonday(new Date())) === toISO(monday);

  return (
    <div className="orarend-page">
      <div className="orarend-header">
        <h2 className="orarend-title">Órarend</h2>
        <div className="view-toggle">
          {VIEW_MODES.map((vm) => (
            <button
              key={vm.id}
              className={`view-btn${mode === vm.id ? " active" : ""}`}
              onClick={() => setMode(vm.id)}
            >
              {vm.label}
            </button>
          ))}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "0 0 1rem 0",
          flexWrap: "wrap",
        }}
      >
        <button className="view-btn" onClick={prevWeek}>←</button>
        <span
          style={{
            minWidth: "170px",
            textAlign: "center",
            color: "var(--text-secondary)",
            fontSize: "0.875rem",
          }}
        >
          {fmtWeekLabel(monday, extraDays)}
        </span>
        <button className="view-btn" onClick={nextWeek}>→</button>
        {!isCurrentWeek && (
          <button className="view-btn" onClick={goToday}>
            Ezen a héten
          </button>
        )}
          <button
            className="view-btn"
            onClick={async () => {
              const start = toISO(monday);
              const endD = new Date(monday);
              endD.setDate(endD.getDate() + 90);
              try {
                const path = await ExportTimetableICS(start, toISO(endD));
                if (path) {
                  alert(
                    "Naptárfájl elmentve:\n" + path +
                    "\n\nGoogle Naptár: Beállítások → Importálás és exportálás → Importálás\n" +
                    "Proton Calendar: Beállítások → Naptárak → Naptár importálása"
                  );
                }
              } catch (e: any) {
                alert(typeof e === "string" ? e : e?.message ?? "Exportálási hiba");
              }
            }}
          >
            Exportálás naptárba (.ics)
        </button>
      </div>
      {loading && (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--text-muted)",
          }}
        >
          Betöltés…
        </div>
      )}
      {error && (
        <div style={{ padding: "1rem", color: "#ef4444" }}>{error}</div>
      )}
      {!loading && !error && (
        <div className="tt-wrapper">
          <table className="tt-table">
            <thead>
              <tr>
                <th className="tt-th-time">Időpont</th>
                {columns.map((col) => (
                  <th
                    key={col.date}
                    className={`tt-th-day${col.isToday ? " tt-today-col" : ""}`}
                  >
                    {col.dayName}
                    {col.isToday && (
                      <span className="tt-today-badge">Ma</span>
                    )}
                    <div
                      style={{
                        fontSize: "0.7rem",
                        opacity: 0.6,
                        fontWeight: 400,
                      }}
                    >
                      {col.shortDate}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allPeriods.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    style={{
                      padding: "2rem",
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    Ezen a héten nincs rögzített óra.
                  </td>
                </tr>
              ) : (
                allPeriods.map((period) => {
                  const sample = sampleByPeriod.get(period);
                  const nowMs = Date.now();

                  return (
                    <tr
                      key={period}
                      className="tt-period-row"
                    >
                      <td className="tt-time-cell">
                        <span className="tt-period-num">{period}.</span>
                        {(() => {
                          const custom = bellMap.get(period);
                          if (custom) {
                            return (
                              <span className="tt-period-range tt-period-custom" title="Egyéni csengetési rend">
                                {custom.start}
                                <br />
                                {custom.end}
                              </span>
                            );
                          }
                          if (sample) {
                            return (
                              <span className="tt-period-range">
                                {fmtTime(sample.start)}
                                <br />
                                {fmtTime(sample.end)}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </td>
                      {columns.map((col) => {
                        const lesson = col.lessons.find(
                          (l) => l.periodIndex === period
                        );

                        const custom = bellMap.get(period);
                        const lessonDate = col.date;

                        const startMs = custom
                          ? customTimeToMs(lessonDate, custom.start)
                          : lesson ? new Date(lesson.start).getTime() : 0;
                        const endMs = custom
                          ? customTimeToMs(lessonDate, custom.end)
                          : lesson ? new Date(lesson.end).getTime() : 0;

                        const isCurrent =
                          col.isToday &&
                          !!lesson &&
                          startMs <= nowMs &&
                          nowMs < endMs;

                        const isPast =
                          col.isToday &&
                          !!lesson &&
                          nowMs >= endMs;

                        return (
                          <td
                            key={col.date}
                            className={`tt-cell${col.isToday ? " tt-today-col" : ""}`}
                          >
                            {lesson ? (
                              <button
                                className={[
                                  "tt-class-block",
                                  isCurrent ? "tt-current" : "",
                                  isPast ? "tt-past" : "",
                                  lesson.isCancelled ? "tt-cancelled" : "",
                                  lesson.substituteTeacher ? "tt-substituted" : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                style={{
                                  opacity: isPast ? 0.45 : 1,
                                  width: "100%",
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                                onClick={() => setSelected(lesson)}
                              >
                                <span className="tt-subject">
                                  {lesson.isCancelled ? "❌ " : ""}
                                  {lesson.subjectName || lesson.name}
                                </span>
                                <span className="tt-room">
                                  {lesson.room ? `${lesson.room}. terem` : ""}
                                </span>
                                {lesson.substituteTeacher ? (
                                  <span className="tt-teacher-line">
                                    <span className="tt-original-teacher">
                                      {lesson.teacher || "Eredeti tanár"}
                                    </span>
                                    <span className="tt-substitute-teacher">
                                      Helyettesít: {lesson.substituteTeacher}
                                    </span>
                                  </span>
                                ) : lesson.teacher ? (
                                  <span className="tt-room">
                                    {lesson.teacher}
                                  </span>
                                ) : null}
                                {lesson.isCancelled && (
                                  <span className="tt-cancelled-label">
                                    Elmarad
                                  </span>
                                )}
                              </button>
                            ) : (
                              <div className="tt-empty" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <LessonModal lesson={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
