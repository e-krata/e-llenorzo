import { useState, useEffect } from "react";
import {
  GetGrades,
  GetTimetable,
  GetHomework,
  GetLocalProfile,
  GetCountdowns,
} from "../../wailsjs/go/main/App";
import type { AccountInfo, Grade, Lesson, Homework } from "../types/kreta";
import type { models } from "../../wailsjs/go/models";

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 4 && h < 10) return "Jó reggelt";
  if (h >= 10 && h < 12) return "Jó délelőtt";
  if (h >= 12 && h < 18) return "Jó napot";
  if (h >= 18 && h < 21) return "Jó estét";
  return "Jó éjszakát";
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function fmtShortDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}.${d.getDate()}.`;
  } catch {
    return iso;
  }
}

type ClassInfo =
  | { type: "class"; lesson: Lesson; remaining: number; duration: number }
  | { type: "upcoming"; lesson: Lesson; minutesUntil: number }
  | { type: "weekend" }
  | { type: "done" }
  | { type: "loading" };

function lessonLocalDate(iso: string): string {
  if (!iso) return "";
  try {
    return toISO(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function getClassInfo(now: Date, lessons: Lesson[]): ClassInfo {
  const today = toISO(now);
  const todayLessons = lessons
    .filter((l) => lessonLocalDate(l.date || l.start) === today)
    .sort((a, b) => a.start.localeCompare(b.start));

  const cur = now.getHours() * 60 + now.getMinutes();
  const toMin = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.getHours() * 60 + d.getMinutes();
    } catch {
      return 0;
    }
  };

  for (const lesson of todayLessons) {
    const start = toMin(lesson.start);
    const end = toMin(lesson.end);
    if (cur >= start && cur < end) {
      return { type: "class", lesson, remaining: end - cur, duration: end - start };
    }
  }

  const upcoming = todayLessons.find((l) => toMin(l.start) > cur);
  if (upcoming) {
    return { type: "upcoming", lesson: upcoming, minutesUntil: toMin(upcoming.start) - cur };
  }

  const day = now.getDay();
  if (day === 0 || day === 6) return { type: "weekend" };
  return { type: "done" };
}

function ClassWidget({ info }: { info: ClassInfo }) {
  if (info.type === "loading") {
    return (
      <div className="class-widget no-class">
        <div className="cw-label">Betöltés…</div>
      </div>
    );
  }
  if (info.type === "class") {
    const pct = Math.min(100, ((info.duration - info.remaining) / info.duration) * 100);
    return (
      <div className="class-widget class-active">
        <div className="cw-label">Jelenlegi óra</div>
        <div className="cw-subject">{info.lesson.subjectName || info.lesson.name}</div>
        <div className="cw-detail">
          {info.lesson.periodIndex}. óra{info.lesson.room ? ` · ${info.lesson.room}. terem` : ""}
        </div>
        <div className="cw-time">
          Vége: {fmtTime(info.lesson.end)} — még {info.remaining} perc
        </div>
        <div className="cw-bar">
          <div className="cw-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }
  if (info.type === "upcoming") {
    return (
      <div className="class-widget upcoming">
        <div className="cw-label">Következő óra</div>
        <div className="cw-subject">{info.lesson.subjectName || info.lesson.name}</div>
        <div className="cw-detail">
          {info.lesson.periodIndex}. óra{info.lesson.room ? ` · ${info.lesson.room}. terem` : ""}
        </div>
        <div className="cw-time">
          Kezdés: {fmtTime(info.lesson.start)} — {info.minutesUntil} perc múlva
        </div>
      </div>
    );
  }
  if (info.type === "weekend") {
    return (
      <div className="class-widget no-class">
        <div className="cw-label">Hétvége</div>
        <div className="cw-subject">Nincs tanítás</div>
        <div className="cw-detail">Pihend ki magad!</div>
      </div>
    );
  }
  return (
    <div className="class-widget no-class">
      <div className="cw-label">Mára kész</div>
      <div className="cw-subject">Nincs több óra</div>
      <div className="cw-detail">Holnap folytatjuk!</div>
    </div>
  );
}

function getNextSchoolDayLesson(now: Date, lessons: Lesson[]): Lesson | null {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dayStr = toISO(d);
    const dayLessons = lessons
      .filter((l) => lessonLocalDate(l.date || l.start) === dayStr && !l.isCancelled)
      .sort((a, b) => a.start.localeCompare(b.start));
    if (dayLessons.length > 0) return dayLessons[0];
  }
  return null;
}

function NextSchoolDayWidget({ lesson }: { lesson: Lesson }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayLabel = lessonLocalDate(lesson.date) === toISO(tomorrow) ? "Holnap először" : "Következő nap";

  return (
    <div className="class-widget upcoming">
      <div className="cw-label">{dayLabel}</div>
      <div className="cw-subject">{lesson.subjectName || lesson.name}</div>
      <div className="cw-detail">
        {lesson.periodIndex}. óra
        {lesson.teacher ? ` · ${lesson.teacher}` : ""}
        {lesson.room ? ` · ${lesson.room}. terem` : ""}
      </div>
      <div className="cw-time">Kezdés: {fmtTime(lesson.start)}</div>
    </div>
  );
}

function gradeColor(v: number): string {
  if (v >= 5) return "#4ade80";
  if (v === 4) return "#86efac";
  if (v === 3) return "#fbbf24";
  if (v === 2) return "#f97316";
  return "#ef4444";
}

function cdColor(days: number): string {
  if (days <= 3)  return "#ef4444";
  if (days <= 7)  return "#f97316";
  if (days <= 14) return "#fbbf24";
  return "#4ade80";
}

function CountdownWidget({ countdowns }: { countdowns: models.Countdown[] }) {
  const visible = countdowns.filter((c) => c.visible && c.daysRemaining >= 0);
  if (visible.length === 0) return null;
  const nearest = visible[0];
  return (
    <div className="card cd-card">
      <div className="card-header">
        <span className="card-dot" style={{ background: cdColor(nearest.daysRemaining) }} />
        <h3>Visszaszámláló</h3>
      </div>
      <div className="card-stat" style={{ color: cdColor(nearest.daysRemaining) }}>
        {nearest.daysRemaining}
      </div>
      <div className="card-stat-label">nap – {nearest.label}</div>
      {visible.length > 1 && (
        <ul className="card-list">
          {visible.slice(1, 4).map((c) => (
            <li key={c.id} className="card-row">
              <span className="row-label">{c.label}</span>
              <span className="tag" style={{ color: cdColor(c.daysRemaining) }}>{c.daysRemaining}n</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface HomePageProps {
  account: AccountInfo;
}

export default function HomePage({ account }: HomePageProps) {
  const [now, setNow] = useState(new Date());
  const [nickname, setNickname] = useState("");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [countdowns, setCountdowns] = useState<models.Countdown[]>([]);
  const [timetableLoading, setTimetableLoading] = useState(true);
  const [gradesLoading, setGradesLoading] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    GetLocalProfile()
      .then((p) => setNickname(p?.nickname ?? ""))
      .catch(() => {});
  }, [account.id]);

  useEffect(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const fetchEnd = new Date(monday);
    fetchEnd.setDate(monday.getDate() + 14);

    setTimetableLoading(true);
    GetTimetable(toISO(monday), toISO(fetchEnd))
      .then((ls) => setLessons(ls ?? []))
      .catch(() => {})
      .finally(() => setTimetableLoading(false));
  }, [account.id]);

  useEffect(() => {
    setGradesLoading(true);
    GetGrades()
      .then((gs) => setGrades((gs ?? []).filter((g) => g.value > 0)))
      .catch(() => {})
      .finally(() => setGradesLoading(false));
  }, [account.id]);

  useEffect(() => {
    const from = new Date();
    from.setDate(from.getDate() - 7);
    GetHomework(toISO(from))
      .then((hw) => setHomework(hw ?? []))
      .catch(() => {});
  }, [account.id]);

  useEffect(() => {
    GetCountdowns()
      .then((cs) => setCountdowns((cs ?? []).sort((a, b) => a.daysRemaining - b.daysRemaining)))
      .catch(() => {});
  }, [account.id]);

  const classInfo: ClassInfo = timetableLoading
    ? { type: "loading" }
    : getClassInfo(now, lessons);

  const nextLesson =
    !timetableLoading && (classInfo.type === "done" || classInfo.type === "weekend")
      ? getNextSchoolDayLesson(now, lessons)
      : null;

  const recentGrades = [...grades]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  const avg =
    grades.length > 0
      ? (grades.reduce((s, g) => s + g.value, 0) / grades.length).toFixed(1)
      : "–";

  const pendingHw = homework.filter((h) => new Date(h.deadline) >= new Date());

  const timeStr = now.toLocaleTimeString("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = now.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const greetName =
    nickname || account.name.split(/\s+/).pop() || account.name;

  return (
    <div className="home-page">
      <section className="greeting-section">
        <div className="greeting-text">
          <h1 className="greeting-headline">
            {getGreeting()}, {greetName}!
          </h1>
          <p className="greeting-date">{dateStr}</p>
          <p className="greeting-clock">{timeStr}</p>
        </div>
        <ClassWidget info={classInfo} />
        {nextLesson && <NextSchoolDayWidget lesson={nextLesson} />}
      </section>

      <CountdownWidget countdowns={countdowns} />

      <section className="summary-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-dot dot-green" />
            <h3>Jegyek átlaga</h3>
          </div>
          {gradesLoading ? (
            <div className="card-stat-label">Betöltés…</div>
          ) : (
            <>
              <div className="card-stat">{avg}</div>
              <div className="card-stat-label">Súlyozott átlag</div>
              <div className="card-footer">{grades.length} bejegyzett jegy</div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-dot dot-yellow" />
            <h3>Házi feladatok</h3>
          </div>
          <div className="card-stat">{pendingHw.length}</div>
          <div className="card-stat-label">Határidős</div>
          <ul className="card-list">
            {pendingHw.slice(0, 4).map((h) => (
              <li key={h.uid} className="card-row">
                <span className="row-label">{h.subjectName}</span>
                <span className="tag">{fmtShortDate(h.deadline)}</span>
              </li>
            ))}
            {pendingHw.length === 0 && (
              <li className="card-row">
                <span className="row-label" style={{ color: "var(--text-muted)" }}>
                  Nincs közelgő házi feladat
                </span>
              </li>
            )}
          </ul>
          {pendingHw.length > 0 && (
            <div className="card-footer">
              Legközelebbi:{" "}
              {fmtShortDate(
                [...pendingHw].sort((a, b) =>
                  a.deadline.localeCompare(b.deadline),
                )[0]?.deadline,
              )}
            </div>
          )}
        </div>

        <div className="card rg-card">
          <div className="card-header">
            <span className="card-dot dot-green" />
            <h3>Legutóbbi jegyek</h3>
          </div>
          {gradesLoading ? (
            <div className="card-stat-label">Betöltés…</div>
          ) : recentGrades.length === 0 ? (
            <div className="card-stat-label">Nincs bejegyzett jegy</div>
          ) : (
            <ul className="rg-list">
              {recentGrades.map((g) => (
                <li key={g.uid} className="rg-row">
                  <div className="rg-info">
                    <span className="rg-subject">{g.subjectName}</span>
                    <span className="rg-date">{fmtShortDate(g.date)}</span>
                  </div>
                  <span
                    className="rg-chip"
                    style={{
                      color: gradeColor(g.value),
                      background: `${gradeColor(g.value)}18`,
                      borderColor: `${gradeColor(g.value)}35`,
                    }}
                  >
                    {g.value}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
