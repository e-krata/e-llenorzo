package kreta

import (
	"ellenorzo/backend/models"
)

type testreszabasResp struct {
	ErtekelesekMegjelenitesenekKesleltetesenekMerteke int `json:"ErtekelesekMegjelenitesenekKesleltetesenekMerteke"`
}

type intezmenyResp struct {
	TestreszabasBeallitasok testreszabasResp `json:"TestreszabasBeallitasok"`
}

type tanuloAdatlapResp struct {
	Uid string `json:"Uid"`
	Nev string `json:"Nev"`
	SzuletesiNev string `json:"SzuletesiNev"`
	SzuletesiHely string `json:"SzuletesiHely"`
	SzuletesiDatum string `json:"SzuletesiDatum"`
	AnyjaNeve string `json:"AnyjaNeve"`
	IntezmenyAzonosito string `json:"IntezmenyAzonosito"`
	IntezmenyNev string `json:"IntezmenyNev"`
	EmailCim string `json:"EmailCim"`
	Telefonszam string `json:"Telefonszam"`
	Cimek []string `json:"Cimek"`
	Intezmeny intezmenyResp `json:"Intezmeny"`
}

func GetStudentDetail(session *models.Session) (*models.StudentDetail, error) {
	var raw tanuloAdatlapResp
	if err := apiGet(session, "/Sajat/TanuloAdatlap", &raw); err != nil {
		return nil, err
	}

	address := ""
	if len(raw.Cimek) > 0 {
		address = raw.Cimek[0]
	}

	return &models.StudentDetail{
		UID: raw.Uid,
		Name: raw.Nev,
		BirthName: raw.SzuletesiNev,
		BirthPlace:raw.SzuletesiHely,
		BirthDate: raw.SzuletesiDatum,
		MothersName: raw.AnyjaNeve,
		Email: raw.EmailCim,
		Phone: raw.Telefonszam,
		InstituteName: raw.IntezmenyNev,
		InstituteCode: raw.IntezmenyAzonosito,
		GradeDelay: raw.Intezmeny.TestreszabasBeallitasok.ErtekelesekMegjelenitesenekKesleltetesenekMerteke,
		Address: address,
	}, nil
}

func GetStudentProfile(session *models.Session) (*models.Student, error) {
	detail, err := GetStudentDetail(session)
	if err != nil {
		return nil, err
	}
	return &models.Student{
		Uid: detail.UID,
		Name: detail.Name,
		SchoolName: detail.InstituteName,
		SchoolCode: detail.InstituteCode,
	}, nil
}
