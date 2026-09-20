package services

import (
	"ellenorzo/backend/kreta"
	"ellenorzo/backend/models"
)

type SchoolService struct{}

func NewSchoolService() *SchoolService { return &SchoolService{} }

func (s *SchoolService) Search(query string) ([]models.Institute, error) {
	return kreta.SearchInstitutes(query)
}
