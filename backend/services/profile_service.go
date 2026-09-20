package services

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sync"
	"ellenorzo/backend/models"
)

type ProfileService struct {
	mu sync.RWMutex
	profile models.LocalProfile
	path string
}

func NewProfileService(cacheDir string) *ProfileService {
	svc := &ProfileService{
		path: filepath.Join(cacheDir, "local_profile.json"),
	}
	if err := svc.load(); err != nil {
		log.Printf("[ProfileService] load: %v (using defaults)", err)
	}
	return svc
}

func (s *ProfileService) load() error {
	data, err := os.ReadFile(s.path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return json.Unmarshal(data, &s.profile)
}

func (s *ProfileService) save() error {
	s.mu.RLock()
	data, err := json.MarshalIndent(s.profile, "", "  ")
	s.mu.RUnlock()
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, data, 0644)
}

func (s *ProfileService) Get() models.LocalProfile {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.profile
}

func (s *ProfileService) Save(p models.LocalProfile) error {
	s.mu.Lock()
	s.profile = p
	s.mu.Unlock()
	return s.save()
}
