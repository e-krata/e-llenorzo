package db

import (
	"log"
	"time"

	"ellenorzo/backend/kreta"
	"ellenorzo/backend/models"
)

func (d *DB) SyncAll(session *models.Session, profileID string) ([]models.Change, error) {
	var changes []models.Change
	newGrades, err := kreta.GetGrades(session)
	if err != nil {
		log.Printf("sync grades: %v", err)
	} else {
		existing, _ := d.GetGrades(profileID)
		existingUIDs := make(map[string]bool, len(existing))
		for _, g := range existing {
			existingUIDs[g.UID] = true
		}
		for _, g := range newGrades {
			if !existingUIDs[g.UID] {
				msg := g.SubjectName + ": " + g.ValueText
				d.AddNotification(profileID, "grade", "Új jegy – "+msg)
				changes = append(changes, models.Change{
					Type:      "grade",
					Content:   "Új jegy – " + msg,
					Timestamp: time.Now().Format(time.RFC3339),
				})
			}
		}
		if err2 := d.UpsertGrades(profileID, newGrades); err2 != nil {
			log.Printf("sync upsert grades: %v", err2)
		}
	}

	newAbsences, err := kreta.GetAbsences(session)
	if err != nil {
		log.Printf("sync absences: %v", err)
	} else {
		existing, _ := d.GetAbsences(profileID)
		existingUIDs := make(map[string]bool, len(existing))
		for _, a := range existing {
			existingUIDs[a.UID] = true
		}
		for _, a := range newAbsences {
			if !existingUIDs[a.UID] {
				msg := a.SubjectName + " – " + a.Date[:10]
				d.AddNotification(profileID, "absence", "Új hiányzás – "+msg)
				changes = append(changes, models.Change{
					Type:      "absence",
					Content:   "Új hiányzás – " + msg,
					Timestamp: time.Now().Format(time.RFC3339),
				})
			}
		}
		if err2 := d.UpsertAbsences(profileID, newAbsences); err2 != nil {
			log.Printf("sync upsert absences: %v", err2)
		}
	}

	newExams, err := kreta.GetExams(session)
	if err != nil {
		log.Printf("sync exams: %v", err)
	} else {
		existing, _ := d.GetExams(profileID)
		existingUIDs := make(map[string]bool, len(existing))
		for _, e := range existing {
			existingUIDs[e.UID] = true
		}
		for _, e := range newExams {
			if !existingUIDs[e.UID] {
				msg := e.SubjectName + " – " + e.TypeName
				d.AddNotification(profileID, "exam", "Új számonkérés – "+msg)
				changes = append(changes, models.Change{
					Type:      "exam",
					Content:   "Új számonkérés – " + msg,
					Timestamp: time.Now().Format(time.RFC3339),
				})
			}
		}
		if err2 := d.UpsertExams(profileID, newExams); err2 != nil {
			log.Printf("sync upsert exams: %v", err2)
		}
	}

	return changes, nil
}
