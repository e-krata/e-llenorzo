package kreta

import (
	"ellenorzo/backend/models"
)

type ertekFajtaResp struct {
	Uid string `json:"Uid"`
}

type tipusResp struct {
	Uid string `json:"Uid"`
	Nev string `json:"Nev"`
}

type tantargyResp struct {
	Uid string `json:"Uid"`
	Nev string `json:"Nev"`
}

type ertekelesResp struct {
	Uid string `json:"Uid"`
	KeszitesDatuma string `json:"KeszitesDatuma"`
	RogzitesDatuma string `json:"RogzitesDatuma"`
	SzamErtek int `json:"SzamErtek"`
	SzovegesErtek string `json:"SzovegesErtek"`
	SulySzazalekErteke int `json:"SulySzazalekErteke"`
	ErtekeloTanarNeve  string `json:"ErtekeloTanarNeve"`
	Tema string `json:"Tema"`
	Tipus tipusResp `json:"Tipus"`
	Tantargy tantargyResp `json:"Tantargy"`
	ErtekFajta ertekFajtaResp `json:"ErtekFajta"`
}

func GetGrades(session *models.Session) ([]models.Grade, error) {
	var raw []ertekelesResp
	if err := apiGet(session, "/Sajat/Ertekelesek", &raw); err != nil {
		return nil, err
	}

	grades := make([]models.Grade, 0, len(raw))
	for _, r := range raw {
		grades = append(grades, models.Grade{
			UID: r.Uid,
			Date: r.KeszitesDatuma,
			WriteDate: r.RogzitesDatuma,
			SubjectUID: r.Tantargy.Uid,
			SubjectName: r.Tantargy.Nev,
			Value: r.SzamErtek,
			ValueText: r.SzovegesErtek,
			Weight: r.SulySzazalekErteke,
			Topic: r.Tema,
			Teacher:r.ErtekeloTanarNeve,
			TypeUID: r.Tipus.Uid,
			TypeName: r.Tipus.Nev,
			IsPercentage: r.ErtekFajta.Uid == "3,Szazalekos",
		})
	}
	return grades, nil
}
