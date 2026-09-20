import { useState, useEffect } from "react";
import { GetHomework } from "../../wailsjs/go/main/App";
import type { Homework } from "../types/kreta";

const DAY_HU = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
const MONTH_HU = [
  "január","február","március","április","május","június",
  "július","augusztus","szeptember","október","november","december",
];

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtDeadline(iso: string): string {
  if (!iso) return "–";
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}. ${MONTH_HU[d.getMonth()]} ${d.getDate()}. (${DAY_HU[d.getDay()]})`;
  } catch {
    return iso;
  }
}

function fmtShort(iso: string): string {
  if (!iso) return "–";
  try {
    const d = new Date(iso);
    return `${MONTH_HU[d.getMonth()].slice(0, 3)}. ${d.getDate()}.`;
  } catch {
    return iso;
  }
}

type HwStatus = "urgent" | "pending" | "completed";

function getStatus(hw: Homework): HwStatus {
  const now = new Date();
  const deadline = new Date(hw.deadline);
  if (deadline < now) return "completed";
  const diff = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 2) return "urgent";
  return "pending";
}

const STATUS_META: Record<HwStatus, { label: string; color: string; bg: string }> = {
  urgent: { label: "Sürgős", color: "#ef4444", bg: "rgba(239,68,68,.15)" },
  pending: { label: "Folyamatban", color: "#fbbf24", bg: "rgba(251,191,36,.15)" },
  completed: { label: "Lejárt", color: "#6b7280", bg: "rgba(107,114,128,.15)" },
};

interface ModalProps {
  hw: Homework;
  onClose: () => void;
}

function HomeworkModal({ hw, onClose }: ModalProps) {
  const status = getStatus(hw);
  const meta = STATUS_META[status];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <div className="hz-backdrop" onClick={onClose} />
      <div className="hz-modal" role="dialog" aria-modal="true">
        <div className="hz-modal-head">
          <span className="hz-modal-subject-tag">{hw.subjectName}</span>
          <button className="hz-modal-close" onClick={onClose} aria-label="Bezárás">
            ✕
          </button>
        </div>
        <h2 className="hz-modal-title">{hw.subjectName}</h2>
        <div className="hz-modal-meta">
          {[
            { label: "Tantárgy", value: hw.subjectName },
            { label: "Tanár", value: hw.teacher },
            { label: "Határidő", value: fmtDeadline(hw.deadline) },
            { label: "Feladás dátuma", value: fmtDeadline(hw.lessonDate) },
          ].map(({ label, value }) => (
            <div key={label} className="hz-meta-row">
              <span className="hz-meta-label">{label}</span>
              <span className="hz-meta-value">{value || "–"}</span>
            </div>
          ))}
          <div className="hz-meta-row">
            <span className="hz-meta-label">Állapot</span>
            <span
              className="hz-meta-status"
              style={{ color: meta.color, backgroundColor: meta.bg }}
            >
              {meta.label}
            </span>
          </div>
        </div>
        {hw.content && (
          <>
            <div className="hz-modal-divider" />
            <div className="hz-modal-desc-label">Leírás</div>
            <div className="hz-modal-desc">{hw.content}</div>
          </>
        )}
      </div>
    </>
  );
}

function HwCard({ hw, onClick }: { hw: Homework; onClick: () => void }) {
  const status = getStatus(hw);
  const meta = STATUS_META[status];

  return (
    <button className={`hz-card hz-card-${status}`} onClick={onClick}>
      <div className="hz-card-top">
        <span className="hz-card-subject">{hw.subjectName}</span>
        <span
          className="hz-card-status"
          style={{ color: meta.color, backgroundColor: meta.bg }}
        >
          {meta.label}
        </span>
      </div>
      <div className="hz-card-title">{hw.teacher}</div>
      <div className="hz-card-desc">
        {(hw.content || "").slice(0, 80)}
        {(hw.content?.length ?? 0) > 80 ? "…" : ""}
      </div>
      <div className="hz-card-footer">
        <span className="hz-card-deadline-label">Határidő</span>
        <span className="hz-card-deadline-val">{fmtShort(hw.deadline)}</span>
      </div>
    </button>
  );
}

export default function HaziFeladatokPage() {
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("Összes");
  const [selected, setSelected] = useState<Homework | null>(null);

  useEffect(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    GetHomework(toISO(from))
      .then((hw) => setHomework(hw ?? []))
      .catch((e: any) =>
        setError(typeof e === "string" ? e : e?.message ?? "Betöltési hiba")
      )
      .finally(() => setLoading(false));
  }, []);

  const subjects = ["Összes", ...Array.from(new Set(homework.map((h) => h.subjectName)))];

  const filtered = (
    filter === "Összes" ? homework : homework.filter((h) => h.subjectName === filter)
  )
    .slice()
    .sort((a, b) => {
      const sa = getStatus(a);
      const sb = getStatus(b);
      if (sa === "completed" && sb !== "completed") return 1;
      if (sb === "completed" && sa !== "completed") return -1;
      return a.deadline.localeCompare(b.deadline);
    });

  const countPending = (subj: string) =>
    (subj === "Összes" ? homework : homework.filter((h) => h.subjectName === subj)).filter(
      (h) => getStatus(h) !== "completed",
    ).length;

  return (
    <div className="hz-page">
      {loading && (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
          Betöltés…
        </div>
      )}
      {error && (
        <div style={{ padding: "1rem", color: "#ef4444" }}>{error}</div>
      )}

      {!loading && !error && (
        <>
          <div className="hz-filter-bar">
            {subjects.map((s) => {
              const cnt = countPending(s);
              return (
                <button
                  key={s}
                  className={`hz-filter-btn${filter === s ? " active" : ""}`}
                  onClick={() => setFilter(s)}
                >
                  {s}
                  {cnt > 0 && <span className="hz-filter-count">{cnt}</span>}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="hz-empty">
              {homework.length === 0
                ? "Nincs házi feladat az elmúlt 30 napból."
                : "Nincs házi feladat ebben a tantárgyban."}
            </div>
          ) : (
            <div className="hz-cards-grid">
              {filtered.map((hw) => (
                <HwCard key={hw.uid} hw={hw} onClick={() => setSelected(hw)} />
              ))}
            </div>
          )}
        </>
      )}

      {selected && (
        <HomeworkModal hw={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
