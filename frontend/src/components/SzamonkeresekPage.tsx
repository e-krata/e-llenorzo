import { useState, useEffect } from "react";
import { GetExams } from "../../wailsjs/go/main/App";
import type { models } from "../../wailsjs/go/models";

type ExamType = "szobeli" | "irasbeli" | "temazaro";

interface DisplayExam {
  uid: string;
  date: string;
  subjectName: string;
  type: ExamType;
  typeName: string;
  topic: string;
  teacher: string;
}

function mapExamType(typeUid: string, typeName: string): ExamType {
  const uid  = typeUid.toLowerCase();
  const name = typeName.toLowerCase();
  if (uid.includes("szobeli")  || name.includes("szóbeli")  || name.includes("szobeli"))  return "szobeli";
  if (uid.includes("temazaro") || name.includes("témazáró") || name.includes("temazaro")) return "temazaro";
  return "irasbeli";
}

function toDisplayExam(e: models.Exam): DisplayExam {
  return {
    uid: e.uid,
    date: e.date?.slice(0, 10) ?? "",
    subjectName: e.subjectName,
    type: mapExamType(e.typeUid ?? "", e.typeName ?? ""),
    typeName: e.typeName ?? "",
    topic: e.description ?? "",
    teacher: e.teacher ?? "",
  };
}

const TYPE_CONFIG: Record<ExamType, { label: string; cls: string }> = {
  szobeli:  { label: "Szóbeli", cls: "test-pill-szobeli"  },
  irasbeli: { label: "Írásbeli", cls: "test-pill-irasbeli" },
  temazaro: { label: "Témazáró", cls: "test-pill-temazaro" },
};

const HU_DAYS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
const HU_DAYS_FULL = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"];
const MONTHS_SHORT = ["jan", "feb", "már", "ápr", "máj", "jún", "júl", "aug", "szep", "okt", "nov", "dec"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtDayHeader(d: Date): string {
  return `${MONTHS_SHORT[d.getMonth()]}. ${d.getDate()}.`;
}

function fmtWeekRange(start: Date): string {
  const end = addDays(start, 6);
  const s = `${start.getFullYear()}. ${MONTHS_SHORT[start.getMonth()]}. ${start.getDate()}.`;
  const e = `${MONTHS_SHORT[end.getMonth()]}. ${end.getDate()}.`;
  return `${s} – ${e}`;
}

const MAX_VISIBLE = 2;

export default function SzamonkeresekPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [exams, setExams] = useState<DisplayExam[]>([]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    GetExams()
      .then((raw) => setExams((raw ?? []).map(toDisplayExam)))
      .catch(() => {});
  }, []);

  const weekStart = addDays(getWeekStart(today), weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const testsMap = new Map<string, DisplayExam[]>();
  exams.forEach((t) => {
    if (!testsMap.has(t.date)) testsMap.set(t.date, []);
    testsMap.get(t.date)!.push(t);
  });

  const isCurrentWeek = weekOffset === 0;

  return (
    <div className="szk-page">
      <div className="szk-header">
        <h1 className="szk-title">Számonkérések</h1>
        <div className="szk-nav">
          <button className="szk-nav-btn" onClick={() => setWeekOffset((n) => n - 1)} aria-label="Előző hét">‹</button>
          <span className="szk-week-label">{fmtWeekRange(weekStart)}</span>
          <button className="szk-nav-btn" onClick={() => setWeekOffset((n) => n + 1)} aria-label="Következő hét">›</button>
          {!isCurrentWeek && (
            <button className="szk-today-btn" onClick={() => setWeekOffset(0)}>Ma</button>
          )}
        </div>
      </div>

      <div className="szk-calendar">
        {days.map((day, i) => {
          const key = isoDate(day);
          const isToday = key === isoDate(today);
          const entries = testsMap.get(key) ?? [];
          const shown = entries.slice(0, MAX_VISIBLE);
          const extra = entries.length - MAX_VISIBLE;

          return (
            <div key={key} className={`szk-col${isCurrentWeek && isToday ? " szk-col-today" : ""}`}>
              <div className={`szk-col-head${isCurrentWeek && isToday ? " szk-col-head-today" : ""}`}>
                <span className="szk-day-short">{HU_DAYS[i]}</span>
                <span className="szk-day-date" title={HU_DAYS_FULL[i]}>{fmtDayHeader(day)}</span>
              </div>
              <div className="szk-col-body">
                {shown.map((t) => {
                  const cfg = TYPE_CONFIG[t.type];
                  return (
                    <div
                      key={t.uid}
                      className={`test-pill ${cfg.cls}`}
                      title={[t.subjectName, t.typeName, t.topic, t.teacher ? `(${t.teacher})` : ""].filter(Boolean).join(" – ")}
                    >
                      <span className="test-pill-type">{cfg.label}</span>
                      <span className="test-pill-subject">{t.subjectName}</span>
                    </div>
                  );
                })}
                {extra > 0 && (
                  <div className="szk-extra">és még {extra}…</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="szk-legend">
        {(["szobeli", "irasbeli", "temazaro"] as ExamType[]).map((type) => {
          const cfg = TYPE_CONFIG[type];
          return (
            <div key={type} className={`szk-legend-item test-pill ${cfg.cls}`}>
              {cfg.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
