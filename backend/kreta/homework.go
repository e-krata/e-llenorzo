package kreta

import (
	"fmt"
	"net/url"

	"ellenorzo/backend/models"
)

type tantargyHwResp struct {
	Uid string `json:"Uid"`
	Nev string `json:"Nev"`
}

type haziFeladatResp struct {
	Uid string `json:"Uid"`
	RogzitesIdopontja string `json:"RogzitesIdopontja"`
	FeladasDatuma string `json:"FeladasDatuma"`
	HataridoDatuma string `json:"HataridoDatuma"`
	Szoveg string `json:"Szoveg"`
	Tantargy tantargyHwResp `json:"Tantargy"`
	RogzitoTanarNeve  string `json:"RogzitoTanarNeve"`
}

func GetHomework(session *models.Session, from string) ([]models.Homework, error) {
	path := fmt.Sprintf("/Sajat/HaziFeladatok?%s", url.Values{
		"datumTol": {from},
	}.Encode())

	var raw []haziFeladatResp
	if err := apiGet(session, path, &raw); err != nil {
		return nil, err
	}

	homeworks := make([]models.Homework, 0, len(raw))
	for _, r := range raw {
		homeworks = append(homeworks, models.Homework{
			UID: r.Uid,
			Date: r.RogzitesIdopontja,
			LessonDate: r.FeladasDatuma,
			Deadline: r.HataridoDatuma,
			Content: r.Szoveg,
			SubjectUID: r.Tantargy.Uid,
			SubjectName: r.Tantargy.Nev,
			Teacher: r.RogzitoTanarNeve,
		})
	}
	return homeworks, nil
}
