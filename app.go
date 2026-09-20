package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"ellenorzo/backend/db"
	"ellenorzo/backend/kreta"
	"ellenorzo/backend/models"
	"ellenorzo/backend/services"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-pdf/fpdf"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx        context.Context
	cacheDir   string
	authSvc    *services.AuthService
	schoolSvc  *services.SchoolService
	accountSvc *services.AccountService
	profileSvc *services.ProfileService
	db         *db.DB
}

func NewApp() *App {
	return &App{
		authSvc:   services.NewAuthService(),
		schoolSvc: NewSchoolService(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	base, err := os.UserCacheDir()
	if err != nil {
		base = os.TempDir()
	}
	a.cacheDir = filepath.Join(base, "toll")
	os.MkdirAll(a.cacheDir, 0755)

	a.accountSvc = services.NewAccountService(a.cacheDir)
	a.profileSvc = services.NewProfileService(a.cacheDir)

	a.authSvc.SetOnRefresh(func(sess *models.Session) {
		if stored := a.accountSvc.GetActive(); stored != nil {
			a.accountSvc.UpdateTokens(
				stored.ID,
				sess.AccessToken,
				sess.RefreshToken,
				sess.ExpiresAt,
			)
		}
	})

	a.accountSvc.TryRestoreActive(a.authSvc)

	if cacheDB, err2 := db.Open(a.cacheDir); err2 == nil {
		a.db = cacheDB
	}
}

func (a *App) currentProfileID() string {
	stored := a.accountSvc.GetActive()
	if stored == nil {
		return "default"
	}
	return stored.ID
}

func (a *App) SearchInstitutes(query string) ([]models.Institute, error) {
	return a.schoolSvc.Search(query)
}

func (a *App) Login(
	institute models.Institute,
	username, password string,
) (*models.AccountInfo, error) {
	username = strings.TrimSpace(username)

	if username == "" {
		return nil, fmt.Errorf("a felhasználónév nem lehet üres")
	}

	if password == "" {
		return nil, fmt.Errorf("a jelszó nem lehet üres")
	}

	accounts := a.accountSvc.GetAllAccounts()

	// Meglévő fiók újrahitelesítése esetén ne akadjon fenn
	// az 5 fiókos limiten.
	for _, account := range accounts {
		if strings.EqualFold(account.Username, username) &&
			account.Institute.InstituteCode == institute.InstituteCode {

			session, err := kreta.Login(institute, username, password)
			if err != nil {
				return nil, err
			}

			name := account.Name

			if student, profileErr := kreta.GetStudentProfile(session); profileErr == nil {
				if strings.TrimSpace(student.Name) != "" {
					name = student.Name
				}
			}

			a.authSvc.SetSession(session)

			return a.accountSvc.UpsertAccount(session, name), nil
		}
	}

	if len(accounts) >= 5 {
		return nil, fmt.Errorf("legfeljebb 5 fiók adható hozzá")
	}

	session, err := kreta.Login(institute, username, password)
	if err != nil {
		return nil, err
	}

	name := username

	if student, profileErr := kreta.GetStudentProfile(session); profileErr == nil {
		if strings.TrimSpace(student.Name) != "" {
			name = student.Name
		}
	}

	a.authSvc.SetSession(session)

	return a.accountSvc.UpsertAccount(session, name), nil
}

func (a *App) GetCurrentAccount() *models.AccountInfo {
	if !a.authSvc.IsLoggedIn() {
		return nil
	}

	stored := a.accountSvc.GetActive()
	if stored == nil {
		return nil
	}

	return &models.AccountInfo{
		ID:            stored.ID,
		Name:          stored.Name,
		Username:      stored.Username,
		InstituteCode: stored.Institute.InstituteCode,
		InstituteName: stored.Institute.InstituteName,
		IsActive:      true,
	}
}

func (a *App) GetAccounts() []models.AccountInfo {
	return a.accountSvc.GetAllAccounts()
}

func (a *App) SwitchAccount(id string) (*models.AccountInfo, error) {
	if err := a.accountSvc.SetActive(id); err != nil {
		return nil, err
	}

	a.accountSvc.TryRestoreActive(a.authSvc)

	return a.GetCurrentAccount(), nil
}

func (a *App) RemoveAccount(id string) error {
	active := a.accountSvc.GetActive()

	if err := a.accountSvc.Remove(id); err != nil {
		return err
	}

	if active != nil && active.ID == id {
		a.authSvc.Logout()
	}

	return nil
}

func (a *App) Logout() {
	a.authSvc.Logout()
}

func (a *App) IsLoggedIn() bool {
	return a.authSvc.IsLoggedIn()
}

func (a *App) GetStudentDetail() (*models.StudentDetail, error) {
	sess, err := a.authSvc.Session()
	if err != nil {
		return nil, err
	}

	return kreta.GetStudentDetail(sess)
}

func (a *App) GetGrades() ([]models.Grade, error) {
	sess, err := a.authSvc.Session()
	if err != nil {
		if a.db != nil {
			return a.db.GetGrades(a.currentProfileID())
		}
		return nil, err
	}

	grades, err := kreta.GetGrades(sess)
	if err != nil {
		if a.db != nil {
			return a.db.GetGrades(a.currentProfileID())
		}
		return nil, err
	}

	if a.db != nil {
		a.db.UpsertGrades(a.currentProfileID(), grades)
	}

	return grades, nil
}

func (a *App) GetAbsences() ([]models.Absence, error) {
	sess, err := a.authSvc.Session()
	if err != nil {
		if a.db != nil {
			return a.db.GetAbsences(a.currentProfileID())
		}
		return nil, err
	}

	absences, err := kreta.GetAbsences(sess)
	if err != nil {
		if a.db != nil {
			return a.db.GetAbsences(a.currentProfileID())
		}
		return nil, err
	}

	if a.db != nil {
		a.db.UpsertAbsences(a.currentProfileID(), absences)
	}

	return absences, nil
}

func (a *App) GetAbsenceStats() ([]models.SubjectAbsenceStat, error) {
	absences, err := a.GetAbsences()
	if err != nil {
		return nil, err
	}

	type stat struct {
		used  int
		total int
	}

	m := make(map[string]*stat)

	for _, absence := range absences {
		subject := absence.SubjectName

		if m[subject] == nil {
			m[subject] = &stat{}
		}

		m[subject].used++
	}

	result := make([]models.SubjectAbsenceStat, 0, len(m))

	for subject, s := range m {
		result = append(result, models.SubjectAbsenceStat{
			SubjectName: subject,
			UsedHours:   s.used,
			MaxHours:    32,
		})
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].SubjectName < result[j].SubjectName
	})

	return result, nil
}

func (a *App) GetExams() ([]models.Exam, error) {
	sess, err := a.authSvc.Session()
	if err != nil {
		if a.db != nil {
			return a.db.GetExams(a.currentProfileID())
		}
		return nil, err
	}

	exams, err := kreta.GetExams(sess)
	if err != nil {
		if a.db != nil {
			return a.db.GetExams(a.currentProfileID())
		}
		return nil, err
	}

	if a.db != nil {
		a.db.UpsertExams(a.currentProfileID(), exams)
	}

	return exams, nil
}

func (a *App) GetTimetable(from, to string) ([]models.Lesson, error) {
	sess, err := a.authSvc.Session()
	if err != nil {
		return nil, err
	}

	return kreta.GetTimetable(sess, from, to)
}

func (a *App) GetHomework(from string) ([]models.Homework, error) {
	sess, err := a.authSvc.Session()
	if err != nil {
		return nil, err
	}

	return kreta.GetHomework(sess, from)
}

func (a *App) GetNotifications() ([]models.Notification, error) {
	if a.db == nil {
		return nil, nil
	}

	return a.db.GetNotifications(a.currentProfileID())
}

func (a *App) MarkRead(id int64) error {
	if a.db == nil {
		return nil
	}

	return a.db.MarkRead(a.currentProfileID(), id)
}

func (a *App) MarkAllRead() error {
	if a.db == nil {
		return nil
	}

	return a.db.MarkAllRead(a.currentProfileID())
}

func (a *App) GetUnreadCount() (int, error) {
	if a.db == nil {
		return 0, nil
	}

	return a.db.UnreadCount(a.currentProfileID())
}

func (a *App) GetCountdowns() ([]models.Countdown, error) {
	if a.db == nil {
		return nil, nil
	}

	return a.db.GetCountdowns(a.currentProfileID())
}

func (a *App) SaveCountdown(c models.Countdown) (models.Countdown, error) {
	if a.db == nil {
		return c, fmt.Errorf("adatbázis nem elérhető")
	}

	return a.db.SaveCountdown(a.currentProfileID(), c)
}

func (a *App) DeleteCountdown(id int64) error {
	if a.db == nil {
		return nil
	}

	return a.db.DeleteCountdown(a.currentProfileID(), id)
}

func (a *App) ToggleCountdown(id int64) error {
	if a.db == nil {
		return nil
	}

	return a.db.ToggleCountdown(a.currentProfileID(), id)
}

func (a *App) GetSubjectColors() ([]models.SubjectColor, error) {
	if a.db == nil {
		return nil, nil
	}

	return a.db.GetSubjectColors(a.currentProfileID())
}

func (a *App) SetSubjectColor(subject, color string) error {
	if a.db == nil {
		return fmt.Errorf("adatbázis nem elérhető")
	}

	return a.db.SetSubjectColor(a.currentProfileID(), subject, color)
}

func (a *App) GetTeacherProfile(
	teacherName string,
) (*models.TeacherProfile, error) {
	grades, err := a.GetGrades()
	if err != nil {
		return nil, err
	}

	profile := &models.TeacherProfile{
		Name:              teacherName,
		GradeDistribution: make(map[int]int),
	}

	subjectSet := make(map[string]bool)
	var sum float64

	for _, grade := range grades {
		if grade.Teacher != teacherName {
			continue
		}

		if grade.IsPercentage || grade.Value < 1 || grade.Value > 5 {
			continue
		}

		subjectSet[grade.SubjectName] = true
		profile.GradeDistribution[grade.Value]++
		sum += float64(grade.Value)
		profile.TotalGrades++
	}

	for subject := range subjectSet {
		profile.Subjects = append(profile.Subjects, subject)
	}

	sort.Strings(profile.Subjects)

	if profile.TotalGrades > 0 {
		profile.AverageGrade =
			sum / float64(profile.TotalGrades)
	}

	return profile, nil
}

func (a *App) GetChangesSinceLastOpen() ([]models.Change, error) {
	if a.db == nil {
		return nil, nil
	}

	lastOpen := a.db.GetMeta("last_open")
	now := time.Now().Format(time.RFC3339)

	a.db.SetMeta("last_open", now)

	if lastOpen == "" || !a.authSvc.IsLoggedIn() {
		return nil, nil
	}

	sess, err := a.authSvc.Session()
	if err != nil {
		return nil, nil
	}

	changes, _ := a.db.SyncAll(
		sess,
		a.currentProfileID(),
	)

	return changes, nil
}

func (a *App) ExportGradesCSV() (string, error) {
	grades, err := a.GetGrades()
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer

	buf.WriteString("\xef\xbb\xbf")
	buf.WriteString(
		"Tárgy;Dátum;Érték;Súly;Téma;Tanár;Típus\n",
	)

	for _, grade := range grades {
		date := grade.Date

		if len(date) > 10 {
			date = date[:10]
		}

		row := fmt.Sprintf(
			"%s;%s;%s;%d;%s;%s;%s\n",
			csvEscape(grade.SubjectName),
			date,
			csvEscape(grade.ValueText),
			grade.Weight,
			csvEscape(grade.Topic),
			csvEscape(grade.Teacher),
			csvEscape(grade.TypeName),
		)

		buf.WriteString(row)
	}

	path, err := wailsRuntime.SaveFileDialog(
		a.ctx,
		wailsRuntime.SaveDialogOptions{
			DefaultFilename: "jegyek_" +
				time.Now().Format("2006-01-02") +
				".csv",
			Filters: []wailsRuntime.FileFilter{
				{
					DisplayName: "CSV fájlok (*.csv)",
					Pattern:     "*.csv",
				},
			},
		},
	)

	if err != nil || path == "" {
		return "", err
	}

	if err = os.WriteFile(path, buf.Bytes(), 0644); err != nil {
		return "", err
	}

	return path, nil
}

func csvEscape(s string) string {
	s = strings.ReplaceAll(s, "\n", " ")

	if strings.ContainsAny(s, ";\"") {
		s = "\"" +
			strings.ReplaceAll(s, "\"", "\"\"") +
			"\""
	}

	return s
}

func (a *App) ExportGradesPDF() (string, error) {
	grades, err := a.GetGrades()
	if err != nil {
		return "", err
	}

	account := a.GetCurrentAccount()

	name := ""
	if account != nil {
		name = account.Name
	}

	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.AddPage()

	pdf.SetFont("Arial", "B", 16)
	pdf.CellFormat(
		0,
		10,
		safeStr("Jegyek – "+name),
		"",
		1,
		"C",
		false,
		0,
		"",
	)

	pdf.SetFont("Arial", "", 10)

	pdf.CellFormat(
		0,
		6,
		safeStr(time.Now().Format("2006-01-02")),
		"",
		1,
		"C",
		false,
		0,
		"",
	)

	pdf.Ln(4)

	pdf.SetFillColor(39, 64, 41)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("Arial", "B", 10)

	pdf.CellFormat(
		55,
		7,
		safeStr("Tárgy"),
		"1",
		0,
		"",
		true,
		0,
		"",
	)

	pdf.CellFormat(
		25,
		7,
		safeStr("Dátum"),
		"1",
		0,
		"",
		true,
		0,
		"",
	)

	pdf.CellFormat(
		20,
		7,
		safeStr("Érték"),
		"1",
		0,
		"C",
		true,
		0,
		"",
	)

	pdf.CellFormat(
		20,
		7,
		safeStr("Súly"),
		"1",
		0,
		"C",
		true,
		0,
		"",
	)

	pdf.CellFormat(
		60,
		7,
		safeStr("Téma"),
		"1",
		1,
		"",
		true,
		0,
		"",
	)

	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Arial", "", 9)

	fill := false

	for _, grade := range grades {
		date := grade.Date

		if len(date) > 10 {
			date = date[:10]
		}

		if fill {
			pdf.SetFillColor(240, 244, 240)
		} else {
			pdf.SetFillColor(255, 255, 255)
		}

		fill = !fill

		pdf.CellFormat(
			55,
			6,
			safeStr(grade.SubjectName),
			"1",
			0,
			"",
			true,
			0,
			"",
		)

		pdf.CellFormat(
			25,
			6,
			safeStr(date),
			"1",
			0,
			"",
			true,
			0,
			"",
		)

		pdf.CellFormat(
			20,
			6,
			safeStr(grade.ValueText),
			"1",
			0,
			"C",
			true,
			0,
			"",
		)

		pdf.CellFormat(
			20,
			6,
			fmt.Sprintf("%d%%", grade.Weight),
			"1",
			0,
			"C",
			true,
			0,
			"",
		)

		pdf.CellFormat(
			60,
			6,
			safeStr(grade.Topic),
			"1",
			1,
			"",
			true,
			0,
			"",
		)
	}

	path, err := wailsRuntime.SaveFileDialog(
		a.ctx,
		wailsRuntime.SaveDialogOptions{
			DefaultFilename: "jegyek_" +
				time.Now().Format("2006-01-02") +
				".pdf",
			Filters: []wailsRuntime.FileFilter{
				{
					DisplayName: "PDF fájlok (*.pdf)",
					Pattern:     "*.pdf",
				},
			},
		},
	)

	if err != nil || path == "" {
		return "", err
	}

	if err = pdf.OutputFileAndClose(path); err != nil {
		return "", err
	}

	return path, nil
}

func (a *App) ExportTimetableICS(from, to string) (string, error) {
	sess, err := a.authSvc.Session()
	if err != nil {
		return "", err
	}

	lessons, err := kreta.GetTimetable(sess, from, to)
	if err != nil {
		return "", err
	}

	name := "Órarend"

	if account := a.GetCurrentAccount(); account != nil {
		name = "Órarend – " + account.Name
	}

	ics := kreta.GenerateTimetableICS(lessons, name)

	path, err := wailsRuntime.SaveFileDialog(
		a.ctx,
		wailsRuntime.SaveDialogOptions{
			DefaultFilename: "orarend_" +
				time.Now().Format("2006-01-02") +
				".ics",
			Filters: []wailsRuntime.FileFilter{
				{
					DisplayName: "iCalendar fájlok (*.ics)",
					Pattern:     "*.ics",
				},
			},
		},
	)

	if err != nil || path == "" {
		return "", err
	}

	if err := os.WriteFile(path, []byte(ics), 0644); err != nil {
		return "", err
	}

	return path, nil
}

func safeStr(s string) string {
	var b strings.Builder

	for _, r := range s {
		if utf8.RuneLen(r) == 1 ||
			(r >= 0x00C0 && r <= 0x00FF) {

			b.WriteRune(r)
		} else {
			switch r {
			case 'á':
				b.WriteRune('\xe1')
			case 'é':
				b.WriteRune('\xe9')
			case 'í':
				b.WriteRune('\xed')
			case 'ó':
				b.WriteRune('\xf3')
			case 'ö':
				b.WriteRune('\xf6')
			case 'ő':
				b.WriteString("o")
			case 'ú':
				b.WriteRune('\xfa')
			case 'ü':
				b.WriteRune('\xfc')
			case 'ű':
				b.WriteString("u")
			case 'Á':
				b.WriteRune('\xc1')
			case 'É':
				b.WriteRune('\xc9')
			case 'Í':
				b.WriteRune('\xcd')
			case 'Ó':
				b.WriteRune('\xd3')
			case 'Ö':
				b.WriteRune('\xd6')
			case 'Ő':
				b.WriteString("O")
			case 'Ú':
				b.WriteRune('\xda')
			case 'Ü':
				b.WriteRune('\xdc')
			case 'Ű':
				b.WriteString("U")
			default:
				b.WriteRune('?')
			}
		}
	}

	return b.String()
}

func (a *App) GetCurrentTheme() string {
	if a.db == nil {
		return "Zöld"
	}

	t := a.db.GetMeta("theme")

	if t == "" {
		return "Zöld"
	}

	return t
}

func (a *App) SetTheme(themeName string) {
	if a.db == nil {
		return
	}

	a.db.SetMeta("theme", themeName)
}

func (a *App) GetCustomColor() string {
	if a.db == nil {
		return "#2d6a4f"
	}

	c := a.db.GetMeta("custom_color")

	if c == "" {
		return "#2d6a4f"
	}

	return c
}

func (a *App) SetCustomColor(color string) {
	if a.db == nil {
		return
	}

	a.db.SetMeta("custom_color", color)
}

func (a *App) GetBellSchedule() []models.BellPeriod {
	if a.db == nil {
		return nil
	}

	raw := a.db.GetMeta("bell_schedule")

	if raw == "" {
		return nil
	}

	var sched []models.BellPeriod

	if err := json.Unmarshal([]byte(raw), &sched); err != nil {
		return nil
	}

	return sched
}

func (a *App) SetBellSchedule(schedule []models.BellPeriod) error {
	if a.db == nil {
		return fmt.Errorf("adatbázis nem elérhető")
	}

	data, err := json.Marshal(schedule)
	if err != nil {
		return err
	}

	a.db.SetMeta("bell_schedule", string(data))

	return nil
}

func (a *App) OpenGitHub() {
	wailsRuntime.BrowserOpenURL(a.ctx, GitHubURL)
}

func (a *App) OpenDeveloper() {
	wailsRuntime.BrowserOpenURL(a.ctx, DeveloperURL)
}

func (a *App) GetLocalProfile() models.LocalProfile {
	return a.profileSvc.Get()
}

func (a *App) SaveLocalProfile(profile models.LocalProfile) error {
	return a.profileSvc.Save(profile)
}

func (a *App) OpenDKT() {
	wailsRuntime.BrowserOpenURL(
		a.ctx,
		"https://ekrata.ct.ws/dkttanulo",
	)
}

type TaskItem struct {
	ID   string `json:"id"`
	Text string `json:"text"`
	Done bool   `json:"done"`
}

type FuzetEntry struct {
	ID        string     `json:"id"`
	Type      string     `json:"type"`
	Title     string     `json:"title"`
	Content   string     `json:"content"`
	Items     []TaskItem `json:"items"`
	ImageData string     `json:"imageData"`
	CreatedAt string     `json:"createdAt"`
	UpdatedAt string     `json:"updatedAt"`
}

func (a *App) entriesPath() string {
	return filepath.Join(a.cacheDir, "entries.json")
}

func (a *App) loadAll() ([]FuzetEntry, error) {
	data, err := os.ReadFile(a.entriesPath())

	if os.IsNotExist(err) {
		return []FuzetEntry{}, nil
	}

	if err != nil {
		return nil, err
	}

	var entries []FuzetEntry

	if err := json.Unmarshal(data, &entries); err != nil {
		return nil, err
	}

	return entries, nil
}

func (a *App) saveAll(entries []FuzetEntry) error {
	data, err := json.MarshalIndent(
		entries,
		"",
		"  ",
	)
	if err != nil {
		return err
	}

	return os.WriteFile(
		a.entriesPath(),
		data,
		0644,
	)
}

func (a *App) LoadEntries() ([]FuzetEntry, error) {
	return a.loadAll()
}

func (a *App) SaveEntry(entry FuzetEntry) error {
	entries, err := a.loadAll()
	if err != nil {
		return err
	}

	now := time.Now().Format(time.RFC3339)

	for i, existing := range entries {
		if existing.ID == entry.ID {
			entry.CreatedAt = existing.CreatedAt
			entry.UpdatedAt = now
			entries[i] = entry

			return a.saveAll(entries)
		}
	}

	if entry.ID == "" {
		b := make([]byte, 8)

		if _, err := rand.Read(b); err != nil {
			return err
		}

		entry.ID = hex.EncodeToString(b)
	}

	entry.CreatedAt = now
	entry.UpdatedAt = now

	entries = append(
		[]FuzetEntry{entry},
		entries...,
	)

	return a.saveAll(entries)
}

func (a *App) DeleteEntry(id string) error {
	entries, err := a.loadAll()
	if err != nil {
		return err
	}

	filtered := entries[:0]

	for _, existing := range entries {
		if existing.ID != id {
			filtered = append(filtered, existing)
		}
	}

	return a.saveAll(filtered)
}

func (a *App) Greet(name string) string {
	return fmt.Sprintf(
		"Hello %s, It's show time!",
		name,
	)
}