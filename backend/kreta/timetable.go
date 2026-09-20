package kreta

import (
	"fmt"
	"net/url"

	"ellenorzo/backend/models"
)

type allapotResp struct {
	Nev string `json:"Nev"`
}

type tantargyOraResp struct {
	Uid string `json:"Uid"`
	Nev string `json:"Nev"`
}

type osztalyCsoportResp struct {
	Nev string `json:"Nev"`
}

type orarendElemResp struct {
	Uid string `json:"Uid"`
	Datum string `json:"Datum"`
	KezdetIdopont string `json:"KezdetIdopont"`
	VegIdopont string `json:"VegIdopont"`
	Oraszam int `json:"Oraszam"`
	TanarNeve string `json:"TanarNeve"`
	HelyettesTanarNeve string `json:"HelyettesTanarNeve"`
	TeremNeve string `json:"TeremNeve"`
	Tema string `json:"Tema"`
	Nev string `json:"Nev"`
	Allapot allapotResp `json:"Allapot"`
	Tantargy tantargyOraResp `json:"Tantargy"`
	IsDigitalisOra bool `json:"IsDigitalisOra"`
	HaziFeladatUid string `json:"HaziFeladatUid"`
	OsztalyCsoport osztalyCsoportResp `json:"OsztalyCsoport"`
	OraEvesSorszama int `json:"OraEvesSorszama"`
}

func GetTimetable(session *models.Session, from, to string) ([]models.Lesson, error) {
	path := fmt.Sprintf("/Sajat/OrarendElemek?%s", url.Values{
		"datumTol": {from},
		"datumIg":  {to},
	}.Encode())

	var raw []orarendElemResp
	if err := apiGet(session, path, &raw); err != nil {
		return nil, err
	}

	lessons := make([]models.Lesson, 0, len(raw))
	for _, r := range raw {
		lessons = append(lessons, models.Lesson{
			UID: r.Uid,
			Date: r.Datum,
			Start: r.KezdetIdopont,
			End: r.VegIdopont,
			PeriodIndex: r.Oraszam,
			SubjectUID: r.Tantargy.Uid,
			SubjectName: r.Tantargy.Nev,
			Teacher: r.TanarNeve,
			SubstituteTeacher: r.HelyettesTanarNeve,
			Room: r.TeremNeve,
			Description: r.Tema,
			Name: r.Nev,
			StatusName: r.Allapot.Nev,
			IsCancelled: r.Allapot.Nev == "Elmaradt",
			IsOnline: r.IsDigitalisOra,
			HomeworkUID: r.HaziFeladatUid,
			GroupName: r.OsztalyCsoport.Nev,
			YearIndex: r.OraEvesSorszama,
		})
	}
	return lessons, nil
}
