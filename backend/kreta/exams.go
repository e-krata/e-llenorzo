package kreta

import (
	"ellenorzo/backend/models"
)

type szamonkeresResp struct {
	Uid string`json:"Uid"`
	Datum string`json:"Datum"`
	Tantargy tantargyResp `json:"Tantargy"`
	Mod tipusResp `json:"Mod"`
	Temaja string `json:"Temaja"`
	RogzitoTanarNeve string `json:"RogzitoTanarNeve"`
}

func GetExams(session *models.Session) ([]models.Exam, error) {
	var raw []szamonkeresResp
	if err := apiGet(session, "/Sajat/BejelentettSzamonkeresek", &raw); err != nil {
		return nil, err
	}

	exams := make([]models.Exam, 0, len(raw))
	for _, r := range raw {
		exams = append(exams, models.Exam{
			UID: r.Uid,
			Date: r.Datum,
			SubjectUID: r.Tantargy.Uid,
			SubjectName: r.Tantargy.Nev,
			TypeUID: r.Mod.Uid,
			TypeName: r.Mod.Nev,
			Description: r.Temaja,
			Teacher: r.RogzitoTanarNeve,
		})
	}
	return exams, nil
}
