package kreta

import (
	"fmt"
	"strings"
	"time"

	"ellenorzo/backend/models"
)

func icsEscape(s string) string {
	r := strings.NewReplacer(
		"\\", "\\\\",
		";", "\\;",
		",", "\\,",
		"\n", "\\n",
	)
	return r.Replace(s)
}

func parseLessonTime(s string) (time.Time, bool) {
	layouts := []string{
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02T15:04:05.999999999",
		"2006-01-02 15:04:05",
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

func icsDateTime(t time.Time) string {
	return t.Format("20060102T150405")
}

func foldLine(line string) string {
	const maxLen = 74
	if len(line) <= maxLen {
		return line
	}
	var b strings.Builder
	for len(line) > maxLen {
		b.WriteString(line[:maxLen])
		b.WriteString("\r\n ")
		line = line[maxLen:]
	}
	b.WriteString(line)
	return b.String()
}

func GenerateTimetableICS(lessons []models.Lesson, calName string) string {
	now := icsDateTime(time.Now())

	var b strings.Builder
	b.WriteString("BEGIN:VCALENDAR\r\n")
	b.WriteString("VERSION:2.0\r\n")
	b.WriteString("PRODID:-//Toll//Ellenorzo Orarend//HU\r\n")
	b.WriteString("CALSCALE:GREGORIAN\r\n")
	b.WriteString("METHOD:PUBLISH\r\n")
	b.WriteString(foldLine(fmt.Sprintf("X-WR-CALNAME:%s", icsEscape(calName))) + "\r\n")
	b.WriteString("X-WR-TIMEZONE:Europe/Budapest\r\n")

	for _, l := range lessons {
		start, ok1 := parseLessonTime(l.Start)
		end, ok2 := parseLessonTime(l.End)
		if !ok1 || !ok2 {
			continue
		}

		summary := l.SubjectName
		if summary == "" {
			summary = l.Name
		}
		if l.IsCancelled {
			summary = "Elmarad: " + summary
		} else if l.SubstituteTeacher != "" {
			summary += " (helyettesítés)"
		}

		var descParts []string
		if l.PeriodIndex > 0 {
			descParts = append(descParts, fmt.Sprintf("%d. óra", l.PeriodIndex))
		}
		if l.Teacher != "" {
			descParts = append(descParts, "Tanár: "+l.Teacher)
		}
		if l.SubstituteTeacher != "" {
			descParts = append(descParts, "Helyettesítő tanár: "+l.SubstituteTeacher)
		}
		if l.Description != "" {
			descParts = append(descParts, "Téma: "+l.Description)
		}
		if l.GroupName != "" {
			descParts = append(descParts, "Csoport: "+l.GroupName)
		}
		if l.StatusName != "" {
			descParts = append(descParts, "Állapot: "+l.StatusName)
		}
		description := strings.Join(descParts, "\\n")

		uid := l.UID
		if uid == "" {
			uid = fmt.Sprintf("%s-%d", start.Format("20060102T150405"), l.PeriodIndex)
		}

		b.WriteString("BEGIN:VEVENT\r\n")
		b.WriteString(foldLine(fmt.Sprintf("UID:%s@toll-ellenorzo", uid)) + "\r\n")
		b.WriteString(fmt.Sprintf("DTSTAMP:%sZ\r\n", now))
		b.WriteString(fmt.Sprintf("DTSTART:%s\r\n", icsDateTime(start)))
		b.WriteString(fmt.Sprintf("DTEND:%s\r\n", icsDateTime(end)))
		b.WriteString(foldLine(fmt.Sprintf("SUMMARY:%s", icsEscape(summary))) + "\r\n")
		if l.Room != "" {
			b.WriteString(foldLine(fmt.Sprintf("LOCATION:%s", icsEscape(l.Room+". terem"))) + "\r\n")
		}
		if description != "" {
			b.WriteString(foldLine(fmt.Sprintf("DESCRIPTION:%s", icsEscape(description))) + "\r\n")
		}
		if l.IsCancelled {
			b.WriteString("STATUS:CANCELLED\r\n")
			b.WriteString("TRANSP:TRANSPARENT\r\n")
		} else {
			b.WriteString("STATUS:CONFIRMED\r\n")
			b.WriteString("TRANSP:OPAQUE\r\n")
		}
		b.WriteString("END:VEVENT\r\n")
	}

	b.WriteString("END:VCALENDAR\r\n")
	return b.String()
}
