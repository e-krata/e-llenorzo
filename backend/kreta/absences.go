package kreta

import (
	"ellenorzo/backend/models"
)

type mulasztasResp struct {
	Uid string `json:"Uid"`
	Datum string `json:"Datum"`
	IgazolasAllapota string `json:"IgazolasAllapota"`
	Mod mulasztasModResp `json:"Mod"`
	Tantargy tantargyResp `json:"Tantargy"`
}

type mulasztasModResp struct {
	Uid string `json:"Uid"`
	Nev string `json:"Nev"`
}

func GetAbsences(session *models.Session) ([]models.Absence, error) {
	var raw []mulasztasResp
	if err := apiGet(session, "/Sajat/Mulasztasok", &raw); err != nil {
		return nil, err
	}

	absences := make([]models.Absence, 0, len(raw))
	for _, r := range raw {
		absences = append(absences, models.Absence{
			UID: r.Uid,
			Date: r.Datum,
			SubjectUID: r.Tantargy.Uid,
			SubjectName: r.Tantargy.Nev,
			IsJustified: r.IgazolasAllapota == "Igazolt",
			TypeName: r.Mod.Nev,
		})
	}
	return absences, nil
}
