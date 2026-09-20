package db

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"
	"ellenorzo/backend/models"
	_ "modernc.org/sqlite"
)

const schema = `
CREATE TABLE IF NOT EXISTS grades (
	uid TEXT PRIMARY KEY,
	profile_id TEXT NOT NULL,
	date TEXT,
	write_date TEXT,
	subject_uid TEXT,
	subject_name TEXT,
	value INTEGER,
	value_text TEXT,
	weight INTEGER,
	topic TEXT,
	teacher TEXT,
	type_uid TEXT,
	type_name TEXT,
	is_percentage INTEGER
);
CREATE TABLE IF NOT EXISTS absences (
	uid TEXT PRIMARY KEY,
	profile_id TEXT NOT NULL,
	date TEXT,
	subject_uid TEXT,
	subject_name TEXT,
	is_justified INTEGER,
	type_name TEXT
);
CREATE TABLE IF NOT EXISTS exams (
	uid TEXT PRIMARY KEY,
	profile_id TEXT NOT NULL,
	date TEXT,
	subject_uid TEXT,
	subject_name TEXT,
	type_uid TEXT,
	type_name TEXT,
	description TEXT,
	teacher TEXT
);
CREATE TABLE IF NOT EXISTS notifications (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	profile_id TEXT NOT NULL,
	type TEXT,
	content TEXT,
	timestamp TEXT,
	is_read INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS countdowns (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	profile_id TEXT NOT NULL,
	label TEXT,
	target_date TEXT,
	visible INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS subject_colors (
	subject TEXT NOT NULL,
	profile_id TEXT NOT NULL,
	color TEXT,
	PRIMARY KEY (subject, profile_id)
);
CREATE TABLE IF NOT EXISTS app_meta (
	key TEXT PRIMARY KEY,
	value TEXT
);
`

type DB struct {
	mu sync.RWMutex
	sqldb *sql.DB
	machineKey []byte
}

var instance *DB
var once sync.Once

func Open(cacheDir string) (*DB, error) {
	var openErr error
	once.Do(func() {
		path := filepath.Join(cacheDir, "toll_cache.db")
		sqldb, err := sql.Open("sqlite", path)
		if err != nil {
			openErr = err
			return
		}
		if _, err = sqldb.Exec(schema); err != nil {
			openErr = fmt.Errorf("schema: %w", err)
			return
		}
		instance = &DB{
			sqldb:     sqldb,
			machineKey: deriveKey(),
		}
	})
	return instance, openErr
}

func deriveKey() []byte {
	hostname, _ := os.Hostname()
	h := sha256.Sum256([]byte("toll-v1:" + hostname))
	return h[:]
}

func (d *DB) encrypt(plain string) string {
	block, err := aes.NewCipher(d.machineKey)
	if err != nil {
		return plain
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return plain
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return plain
	}
	sealed := gcm.Seal(nonce, nonce, []byte(plain), nil)
	return base64.StdEncoding.EncodeToString(sealed)
}

func (d *DB) decrypt(enc string) string {
	data, err := base64.StdEncoding.DecodeString(enc)
	if err != nil {
		return enc
	}
	block, err := aes.NewCipher(d.machineKey)
	if err != nil {
		return enc
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return enc
	}
	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return enc
	}
	plain, err := gcm.Open(nil, data[:nonceSize], data[nonceSize:], nil)
	if err != nil {
		return enc
	}
	return string(plain)
}

func (d *DB) UpsertGrades(profileID string, grades []models.Grade) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	tx, err := d.sqldb.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`INSERT OR REPLACE INTO grades
		(uid,profile_id,date,write_date,subject_uid,subject_name,value,value_text,weight,topic,teacher,type_uid,type_name,is_percentage)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, g := range grades {
		ip := 0
		if g.IsPercentage {
			ip = 1
		}
		if _, err = stmt.Exec(g.UID, profileID, g.Date, g.WriteDate, g.SubjectUID, g.SubjectName,
			g.Value, g.ValueText, g.Weight, g.Topic, g.Teacher, g.TypeUID, g.TypeName, ip); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (d *DB) GetGrades(profileID string) ([]models.Grade, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	rows, err := d.sqldb.Query(`SELECT uid,date,write_date,subject_uid,subject_name,value,value_text,weight,topic,teacher,type_uid,type_name,is_percentage
		FROM grades WHERE profile_id=? ORDER BY date DESC`, profileID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var grades []models.Grade
	for rows.Next() {
		var g models.Grade
		var ip int
		if err = rows.Scan(&g.UID, &g.Date, &g.WriteDate, &g.SubjectUID, &g.SubjectName,
			&g.Value, &g.ValueText, &g.Weight, &g.Topic, &g.Teacher, &g.TypeUID, &g.TypeName, &ip); err != nil {
			return nil, err
		}
		g.IsPercentage = ip == 1
		grades = append(grades, g)
	}
	return grades, nil
}

func (d *DB) UpsertAbsences(profileID string, absences []models.Absence) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	tx, err := d.sqldb.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`INSERT OR REPLACE INTO absences
		(uid,profile_id,date,subject_uid,subject_name,is_justified,type_name)
		VALUES (?,?,?,?,?,?,?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, a := range absences {
		ij := 0
		if a.IsJustified {
			ij = 1
		}
		if _, err = stmt.Exec(a.UID, profileID, a.Date, a.SubjectUID, a.SubjectName, ij, a.TypeName); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (d *DB) GetAbsences(profileID string) ([]models.Absence, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	rows, err := d.sqldb.Query(`SELECT uid,date,subject_uid,subject_name,is_justified,type_name
		FROM absences WHERE profile_id=? ORDER BY date DESC`, profileID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var absences []models.Absence
	for rows.Next() {
		var a models.Absence
		var ij int
		if err = rows.Scan(&a.UID, &a.Date, &a.SubjectUID, &a.SubjectName, &ij, &a.TypeName); err != nil {
			return nil, err
		}
		a.IsJustified = ij == 1
		absences = append(absences, a)
	}
	return absences, nil
}

func (d *DB) UpsertExams(profileID string, exams []models.Exam) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	tx, err := d.sqldb.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`INSERT OR REPLACE INTO exams
		(uid,profile_id,date,subject_uid,subject_name,type_uid,type_name,description,teacher)
		VALUES (?,?,?,?,?,?,?,?,?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, e := range exams {
		if _, err = stmt.Exec(e.UID, profileID, e.Date, e.SubjectUID, e.SubjectName, e.TypeUID, e.TypeName, e.Description, e.Teacher); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (d *DB) GetExams(profileID string) ([]models.Exam, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	rows, err := d.sqldb.Query(`SELECT uid,date,subject_uid,subject_name,type_uid,type_name,description,teacher
		FROM exams WHERE profile_id=? ORDER BY date ASC`, profileID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var exams []models.Exam
	for rows.Next() {
		var e models.Exam
		if err = rows.Scan(&e.UID, &e.Date, &e.SubjectUID, &e.SubjectName, &e.TypeUID, &e.TypeName, &e.Description, &e.Teacher); err != nil {
			return nil, err
		}
		exams = append(exams, e)
	}
	return exams, nil
}

func (d *DB) AddNotification(profileID, ntype, content string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	_, err := d.sqldb.Exec(`INSERT INTO notifications (profile_id,type,content,timestamp,is_read)
		VALUES (?,?,?,?,0)`, profileID, ntype, content, time.Now().Format(time.RFC3339))
	return err
}

func (d *DB) GetNotifications(profileID string) ([]models.Notification, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	rows, err := d.sqldb.Query(`SELECT id,type,content,timestamp,is_read
		FROM notifications WHERE profile_id=? ORDER BY id DESC LIMIT 100`, profileID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ns []models.Notification
	for rows.Next() {
		var n models.Notification
		var ir int
		if err = rows.Scan(&n.ID, &n.Type, &n.Content, &n.Timestamp, &ir); err != nil {
			return nil, err
		}
		n.IsRead = ir == 1
		ns = append(ns, n)
	}
	return ns, nil
}

func (d *DB) MarkRead(profileID string, id int64) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	_, err := d.sqldb.Exec(`UPDATE notifications SET is_read=1 WHERE id=? AND profile_id=?`, id, profileID)
	return err
}

func (d *DB) MarkAllRead(profileID string) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	_, err := d.sqldb.Exec(`UPDATE notifications SET is_read=1 WHERE profile_id=?`, profileID)
	return err
}

func (d *DB) UnreadCount(profileID string) (int, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()
	var c int
	err := d.sqldb.QueryRow(`SELECT COUNT(*) FROM notifications WHERE profile_id=? AND is_read=0`, profileID).Scan(&c)
	return c, err
}

func (d *DB) GetCountdowns(profileID string) ([]models.Countdown, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	rows, err := d.sqldb.Query(`SELECT id,label,target_date,visible FROM countdowns
		WHERE profile_id=? ORDER BY target_date ASC`, profileID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	today := time.Now().Truncate(24 * time.Hour)
	var cs []models.Countdown
	for rows.Next() {
		var c models.Countdown
		var vis int
		if err = rows.Scan(&c.ID, &c.Label, &c.TargetDate, &vis); err != nil {
			return nil, err
		}
		c.Visible = vis == 1
		if t, err2 := time.Parse("2006-01-02", c.TargetDate); err2 == nil {
			c.DaysRemaining = int(t.Truncate(24*time.Hour).Sub(today).Hours() / 24)
		}
		cs = append(cs, c)
	}
	return cs, nil
}

func (d *DB) SaveCountdown(profileID string, c models.Countdown) (models.Countdown, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	vis := 1
	if !c.Visible {
		vis = 0
	}
	if c.ID == 0 {
		res, err := d.sqldb.Exec(`INSERT INTO countdowns (profile_id,label,target_date,visible) VALUES (?,?,?,?)`,
			profileID, c.Label, c.TargetDate, vis)
		if err != nil {
			return c, err
		}
		c.ID, _ = res.LastInsertId()
	} else {
		_, err := d.sqldb.Exec(`UPDATE countdowns SET label=?,target_date=?,visible=? WHERE id=? AND profile_id=?`,
			c.Label, c.TargetDate, vis, c.ID, profileID)
		if err != nil {
			return c, err
		}
	}
	return c, nil
}

func (d *DB) DeleteCountdown(profileID string, id int64) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	_, err := d.sqldb.Exec(`DELETE FROM countdowns WHERE id=? AND profile_id=?`, id, profileID)
	return err
}

func (d *DB) ToggleCountdown(profileID string, id int64) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	_, err := d.sqldb.Exec(`UPDATE countdowns SET visible = CASE WHEN visible=1 THEN 0 ELSE 1 END
		WHERE id=? AND profile_id=?`, id, profileID)
	return err
}

func (d *DB) GetSubjectColors(profileID string) ([]models.SubjectColor, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	rows, err := d.sqldb.Query(`SELECT subject,color FROM subject_colors WHERE profile_id=?`, profileID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var scs []models.SubjectColor
	for rows.Next() {
		var sc models.SubjectColor
		if err = rows.Scan(&sc.Subject, &sc.Color); err != nil {
			return nil, err
		}
		scs = append(scs, sc)
	}
	return scs, nil
}

func (d *DB) SetSubjectColor(profileID, subject, color string) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	_, err := d.sqldb.Exec(`INSERT OR REPLACE INTO subject_colors (subject,profile_id,color) VALUES (?,?,?)`,
		subject, profileID, color)
	return err
}

func (d *DB) GetMeta(key string) string {
	d.mu.RLock()
	defer d.mu.RUnlock()
	var val string
	d.sqldb.QueryRow(`SELECT value FROM app_meta WHERE key=?`, key).Scan(&val)
	return val
}

func (d *DB) SetMeta(key, value string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.sqldb.Exec(`INSERT OR REPLACE INTO app_meta (key,value) VALUES (?,?)`, key, value)
}

func (d *DB) Encrypt(s string) string { return d.encrypt(s) }
func (d *DB) Decrypt(s string) string { return d.decrypt(s) }
