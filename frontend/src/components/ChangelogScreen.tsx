import type { models } from "../../wailsjs/go/models";

const TYPE_ICON: Record<string, string> = {
  grade: "Jegy",
  absence: "Hiányzás",
  exam: "Számonkérés",
};

interface Props {
  changes: models.Change[];
  onDismiss: () => void;
}

export default function ChangelogScreen({ changes, onDismiss }: Props) {
  return (
    <div className="changelog-screen">
      <div className="changelog-card">
        <h1 className="changelog-title">Mi újság azóta?</h1>
        <p className="changelog-subtitle">{changes.length} változás az utolsó megnyitás óta</p>

        <div className="changelog-list">
          {changes.map((c, i) => (
            <div key={i} className={`changelog-item changelog-item-${c.type}`}>
              <span className="changelog-type">{TYPE_ICON[c.type] ?? c.type}</span>
              <span className="changelog-content">{c.content}</span>
            </div>
          ))}
        </div>

        <button className="changelog-btn" onClick={onDismiss}>
          Rendben
        </button>
      </div>
    </div>
  );
}
