import { useState, useEffect, useRef, useCallback } from "react";
import { LoadEntries, SaveEntry, DeleteEntry } from "../../wailsjs/go/main/App";
type EntryType = "note" | "task" | "image";

interface TaskItem {
  id: string;
  text: string;
  done: boolean;
}

interface FuzetEntry {
  id: string;
  type: EntryType;
  title: string;
  content: string;
  items: TaskItem[];
  imageData: string;
  createdAt: string;
  updatedAt: string;
}

const IS_WAILS = typeof (window as any).go !== "undefined";
const LS_KEY = "fz_entries";

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function apiLoad(): Promise<FuzetEntry[]> {
  if (IS_WAILS) {
    return ((await LoadEntries()) as FuzetEntry[]) || [];
  }
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

async function apiSave(entry: FuzetEntry): Promise<FuzetEntry> {
  const now = new Date().toISOString();
  let e = entry;
  if (!e.id) e = { ...e, id: genId(), createdAt: now, updatedAt: now };
  else e = { ...e, updatedAt: now };

  if (IS_WAILS) {
    await SaveEntry(e as any);
    return e;
  }
  const all = await apiLoad();
  const idx = all.findIndex((x) => x.id === e.id);
  if (idx >= 0) all[idx] = e;
  else all.unshift(e);
  localStorage.setItem(LS_KEY, JSON.stringify(all));
  return e;
}

async function apiDelete(id: string): Promise<void> {
  if (IS_WAILS) {
    await DeleteEntry(id);
    return;
  }
  const all = await apiLoad();
  localStorage.setItem(LS_KEY, JSON.stringify(all.filter((e) => e.id !== id)));
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1600;
        const ratio = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas
          .getContext("2d")!
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = ev.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const MONTHS_SHORT = [
  "jan",
  "feb",
  "már",
  "ápr",
  "máj",
  "jún",
  "júl",
  "aug",
  "szep",
  "okt",
  "nov",
  "dec",
];

function fmtDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}. ${MONTHS_SHORT[d.getMonth()]}. ${d.getDate()}.`;
}

function emptyEntry(type: EntryType): FuzetEntry {
  return {
    id: "",
    type,
    title: "",
    content: "",
    items: [],
    imageData: "",
    createdAt: "",
    updatedAt: "",
  };
}

const TYPE_META: Record<EntryType, { icon: string; label: string }> = {
  note: { icon: "", label: "Jegyzet" },
  task: { icon: "", label: "Feladat" },
  image: { icon: "", label: "Kép" },
};

function EntryCard({
  entry,
  onClick,
  onDelete,
  onToggleItem,
}: {
  entry: FuzetEntry;
  onClick: () => void;
  onDelete: () => void;
  onToggleItem: (itemId: string) => void;
}) {
  const meta = TYPE_META[entry.type];

  return (
    <div className={`fz-card fz-card-${entry.type}`} onClick={onClick}>
      <div className="fz-card-head">
        <span className="fz-type-badge">
          {meta.label}
        </span>
        <button
          className="fz-card-del"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Törlés"
          aria-label="Törlés"
        >
          ×
        </button>
      </div>

      <div className="fz-card-title">{entry.title || <em>Névtelen</em>}</div>

      {entry.type === "note" && (
        <div className="fz-card-preview fz-note-preview">
          {entry.content.slice(0, 120)}
          {entry.content.length > 120 ? "…" : ""}
        </div>
      )}

      {entry.type === "task" && (
        <div className="fz-card-preview fz-task-preview">
          {entry.items.slice(0, 4).map((item) => (
            <div
              key={item.id}
              className={`fz-task-row${item.done ? " done" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleItem(item.id);
              }}
            >
              <span className="fz-task-cb">{item.done ? "☑" : "☐"}</span>
              <span className="fz-task-text">{item.text}</span>
            </div>
          ))}
          {entry.items.length > 4 && (
            <div className="fz-task-more">
              +{entry.items.length - 4} további
            </div>
          )}
          {entry.items.length > 0 && (
            <div className="fz-task-progress">
              {entry.items.filter((i) => i.done).length} / {entry.items.length}{" "}
              kész
            </div>
          )}
        </div>
      )}

      {entry.type === "image" && entry.imageData && (
        <div className="fz-card-preview fz-image-preview">
          <img src={entry.imageData} alt={entry.title} className="fz-thumb" />
        </div>
      )}

      <div className="fz-card-foot">
        <span className="fz-card-date">{fmtDate(entry.updatedAt)}</span>
      </div>
    </div>
  );
}

function FuzetModal({
  initial,
  isNew,
  onSave,
  onClose,
}: {
  initial: FuzetEntry;
  isNew: boolean;
  onSave: (e: FuzetEntry) => void;
  onClose: () => void;
}) {
  const [entry, setEntry] = useState<FuzetEntry>(initial);
  const [newItemText, setNewItemText] = useState("");
  const [imgLoading, setImgLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const set = (patch: Partial<FuzetEntry>) =>
    setEntry((p) => ({ ...p, ...patch }));

  const addItem = () => {
    if (!newItemText.trim()) return;
    set({
      items: [
        ...entry.items,
        { id: genId(), text: newItemText.trim(), done: false },
      ],
    });
    setNewItemText("");
  };

  const toggleItem = (id: string) =>
    set({
      items: entry.items.map((i) =>
        i.id === id ? { ...i, done: !i.done } : i,
      ),
    });

  const removeItem = (id: string) =>
    set({ items: entry.items.filter((i) => i.id !== id) });

  const handleImage = async (file: File) => {
    setImgLoading(true);
    const data = await compressImage(file);
    set({ imageData: data });
    setImgLoading(false);
  };

  const canSave =
    entry.type === "image" ? !!entry.imageData : !!entry.title.trim();

  return (
    <>
      <div className="fz-backdrop" onClick={onClose} />
      <div className="fz-modal" role="dialog" aria-modal="true">
        <div className="fz-modal-head">
          <span className="fz-modal-title">
            {isNew
              ? `Új ${TYPE_META[entry.type].label.toLowerCase()}`
              : `Szerkesztés`}
          </span>
          <button
            className="fz-modal-close"
            onClick={onClose}
            aria-label="Bezárás"
          >
            ✕
          </button>
        </div>
        <div className="fz-modal-body">
          {isNew && (
            <div className="fz-type-sel">
              {(["note", "task", "image"] as EntryType[]).map((t) => (
                <button
                  key={t}
                  className={`fz-type-sel-btn${entry.type === t ? " active" : ""}`}
                  onClick={() => set({ type: t })}
                >
                  {TYPE_META[t].label}
                </button>
              ))}
            </div>
          )}
          <div className="fz-field">
            <label className="fz-label">Cím</label>
            <input
              ref={titleRef}
              className="fz-input"
              type="text"
              value={entry.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Adj nevet a bejegyzésnek…"
            />
          </div>
          {entry.type === "note" && (
            <div className="fz-field">
              <label className="fz-label">Tartalom</label>
              <textarea
                className="fz-textarea"
                rows={7}
                value={entry.content}
                onChange={(e) => set({ content: e.target.value })}
                placeholder="Ide írhatod a megjegyzésed…"
              />
            </div>
          )}
          {entry.type === "task" && (
            <div className="fz-field">
              <label className="fz-label">Feladatok</label>
              {entry.items.length > 0 && (
                <div className="fz-items-list">
                  {entry.items.map((item) => (
                    <div key={item.id} className="fz-item-row">
                      <button
                        className={`fz-item-cb${item.done ? " done" : ""}`}
                        onClick={() => toggleItem(item.id)}
                        aria-label={
                          item.done ? "Megjelölés elvégzetlennek" : "Kész"
                        }
                      >
                        {item.done ? "☑" : "☐"}
                      </button>
                      <span
                        className={`fz-item-text${item.done ? " done" : ""}`}
                      >
                        {item.text}
                      </span>
                      <button
                        className="fz-item-del"
                        onClick={() => removeItem(item.id)}
                        aria-label="Törlés"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="fz-add-item-row">
                <input
                  className="fz-input fz-add-input"
                  type="text"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addItem();
                    }
                  }}
                  placeholder="Új feladatelem (Enter)…"
                />
                <button
                  className="fz-add-item-btn"
                  onClick={addItem}
                  title="Hozzáadás"
                >
                  +
                </button>
              </div>
            </div>
          )}
          {entry.type === "image" && (
            <div className="fz-field">
              <label className="fz-label">Kép</label>
              {entry.imageData ? (
                <div className="fz-img-preview-wrap">
                  <img
                    src={entry.imageData}
                    alt="előnézet"
                    className="fz-img-preview"
                  />
                  <button
                    className="fz-img-remove"
                    onClick={() => set({ imageData: "" })}
                  >
                    ✕ Eltávolítás
                  </button>
                </div>
              ) : (
                <div
                  className="fz-drop-zone"
                  onDrop={async (e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f?.type.startsWith("image/")) await handleImage(f);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileRef.current?.click()}
                >
                  {imgLoading ? (
                    <span>Feldolgozás…</span>
                  ) : (
                    <>
                      <span>Kattints vagy húzd ide a képet</span>
                      <span className="fz-drop-hint">
                        JPG, PNG, WEBP · max 1600 px
                      </span>
                    </>
                  )}
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) await handleImage(f);
                }}
              />
            </div>
          )}
        </div>
        <div className="fz-modal-foot">
          <button className="fz-btn fz-btn-cancel" onClick={onClose}>
            Mégse
          </button>
          <button
            className="fz-btn fz-btn-save"
            onClick={() => onSave(entry)}
            disabled={!canSave}
          >
            Mentés
          </button>
        </div>
      </div>
    </>
  );
}

function DeleteConfirm({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onCancel]);

  return (
    <>
      <div className="fz-backdrop fz-del-backdrop" onClick={onCancel} />
      <div className="fz-del-dialog" role="alertdialog">
        <div className="fz-del-msg">Biztosan törlöd?</div>
        <div className="fz-del-msg-sub">A törlés nem vonható vissza.</div>
        <div className="fz-del-btns">
          <button className="fz-btn fz-btn-cancel" onClick={onCancel}>
            Mégsem
          </button>
          <button className="fz-btn fz-btn-danger" onClick={onConfirm}>
            Törlés
          </button>
        </div>
      </div>
    </>
  );
}

const FILTERS: { id: "all" | EntryType; label: string }[] = [
  { id: "all", label: "Összes" },
  { id: "note", label: "Jegyzetek" },
  { id: "task", label: "Feladatok" },
  { id: "image", label: "Képek" },
];

export default function FuzetPage() {
  const [entries, setEntries] = useState<FuzetEntry[]>([]);
  const [filter, setFilter] = useState<"all" | EntryType>("all");
  const [modal, setModal] = useState<{
    entry: FuzetEntry;
    isNew: boolean;
  } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiLoad().then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  const reload = useCallback(async () => {
    setEntries(await apiLoad());
  }, []);

  const handleSave = async (entry: FuzetEntry) => {
    await apiSave(entry);
    await reload();
    setModal(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await apiDelete(deleteId);
    await reload();
    setDeleteId(null);
  };

  const handleToggleItem = async (entryId: string, itemId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    const updated: FuzetEntry = {
      ...entry,
      items: entry.items.map((i) =>
        i.id === itemId ? { ...i, done: !i.done } : i,
      ),
    };
    await apiSave(updated);
    await reload();
  };

  const visible =
    filter === "all" ? entries : entries.filter((e) => e.type === filter);

  return (
    <div className="fz-page">
      <div className="fz-page-header">
        <h1 className="fz-page-title">Füzet</h1>
        <div className="fz-create-row">
          <button
            className="fz-create-btn fz-cb-note"
            onClick={() => setModal({ entry: emptyEntry("note"), isNew: true })}
          >
            Új jegyzet
          </button>
          <button
            className="fz-create-btn fz-cb-task"
            onClick={() => setModal({ entry: emptyEntry("task"), isNew: true })}
          >
            Új feladat
          </button>
          <button
            className="fz-create-btn fz-cb-image"
            onClick={() =>
              setModal({ entry: emptyEntry("image"), isNew: true })
            }
          >
            Kép feltöltése
          </button>
        </div>
      </div>
      <div className="fz-filter-bar">
        {FILTERS.map((f) => {
          const cnt =
            f.id === "all"
              ? entries.length
              : entries.filter((e) => e.type === f.id).length;
          return (
            <button
              key={f.id}
              className={`fz-ftab${filter === f.id ? " active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              {cnt > 0 && <span className="fz-ftab-cnt">{cnt}</span>}
            </button>
          );
        })}
      </div>
      {loading ? (
        <div className="fz-empty">Betöltés…</div>
      ) : visible.length === 0 ? (
        <div className="fz-empty">
          <div className="fz-empty-msg">
            {filter === "all"
              ? "A füzeted még üres. Hozz létre egy bejegyzést!"
              : `Nincs ${filter === "note" ? "bejegyzett jegyzet" : filter === "task" ? "feladatlista" : "feltöltött kép"}.`}
          </div>
        </div>
      ) : (
        <div className="fz-grid">
          {visible.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onClick={() => setModal({ entry: { ...entry }, isNew: false })}
              onDelete={() => setDeleteId(entry.id)}
              onToggleItem={(itemId) => handleToggleItem(entry.id, itemId)}
            />
          ))}
        </div>
      )}
      {modal && (
        <FuzetModal
          initial={modal.entry}
          isNew={modal.isNew}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {deleteId && (
        <DeleteConfirm
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
