import { useState, useEffect, useRef } from "react";
import { GetTeacherProfile } from "../../wailsjs/go/main/App";
import type { models } from "../../wailsjs/go/models";

interface Props {
  teacherName: string;
  onClose: () => void;
}

export default function TeacherPanel({ teacherName, onClose }: Props) {
  const [profile, setProfile] = useState<models.TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    GetTeacherProfile(teacherName)
      .then((p) => {
        setProfile(p ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [teacherName]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const dist = profile?.gradeDistribution ?? {};
  const maxCount = Math.max(...Object.values(dist), 1);

  return (
    <div className="teacher-overlay">
      <div className="teacher-panel" ref={panelRef}>
        <div className="teacher-header">
          <span className="teacher-name">{teacherName}</span>
          <button className="teacher-close" onClick={onClose} aria-label="Bezárás">×</button>
        </div>

        {loading && <p className="teacher-loading">Betöltés…</p>}

        {!loading && profile && (
          <div className="teacher-body">
            {profile.subjects.length > 0 && (
              <div className="teacher-section">
                <div className="teacher-section-label">Tárgyak</div>
                <div className="teacher-subjects">
                  {profile.subjects.map((s) => (
                    <span key={s} className="teacher-subject-chip">{s}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="teacher-section">
              <div className="teacher-section-label">Átlagos jegy</div>
              <div className="teacher-avg">
                {profile.totalGrades > 0
                  ? profile.averageGrade.toFixed(2)
                  : "—"}
                <span className="teacher-total"> ({profile.totalGrades} jegy)</span>
              </div>
            </div>

            {profile.totalGrades > 0 && (
              <div className="teacher-section">
                <div className="teacher-section-label">Jegyeloszlás</div>
                <div className="teacher-dist">
                  {[1, 2, 3, 4, 5].map((v) => {
                    const cnt = dist[v] ?? 0;
                    const pct = Math.round((cnt / maxCount) * 100);
                    return (
                      <div key={v} className="teacher-dist-row">
                        <span className="teacher-dist-label">{v}</span>
                        <div className="teacher-dist-track">
                          <div
                            className="teacher-dist-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="teacher-dist-count">{cnt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && !profile && (
          <p className="teacher-loading">Nem található adat ehhez a tanárhoz.</p>
        )}
      </div>
    </div>
  );
}
