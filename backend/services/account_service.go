package services

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
	"ellenorzo/backend/kreta"
	"ellenorzo/backend/models"
)

type AccountService struct {
	mu       sync.RWMutex
	accounts []models.StoredAccount
	path     string
}

func NewAccountService(cacheDir string) *AccountService {
	svc := &AccountService{
		path: filepath.Join(cacheDir, "accounts.json"),
	}
	if err := svc.load(); err != nil {
		log.Printf("[AccountService] load: %v (starting empty)", err)
	}
	return svc
}

func (s *AccountService) load() error {
	data, err := os.ReadFile(s.path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return json.Unmarshal(data, &s.accounts)
}

func (s *AccountService) save() error {
	s.mu.RLock()
	data, err := json.MarshalIndent(s.accounts, "", "  ")
	s.mu.RUnlock()
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, data, 0600)
}

func (s *AccountService) UpsertAccount(sess *models.Session, name string) *models.AccountInfo {
	id := makeID(sess.Institute.InstituteCode, sess.Username)

	s.mu.Lock()
	found := false
	for i := range s.accounts {
		s.accounts[i].IsActive = (s.accounts[i].ID == id)
		if s.accounts[i].ID == id {
			s.accounts[i].Name = name
			s.accounts[i].AccessToken = sess.AccessToken
			s.accounts[i].RefreshToken = sess.RefreshToken
			s.accounts[i].ExpiresAt = sess.ExpiresAt
			found = true
		}
	}
	if !found {
		for i := range s.accounts {
			s.accounts[i].IsActive = false
		}
		s.accounts = append(s.accounts, models.StoredAccount{
			ID: id,
			Name: name,
			Username: sess.Username,
			Institute: sess.Institute,
			AccessToken: sess.AccessToken,
			RefreshToken: sess.RefreshToken,
			ExpiresAt: sess.ExpiresAt,
			IsActive: true,
		})
	}
	s.mu.Unlock()

	if err := s.save(); err != nil {
		log.Printf("[AccountService] save: %v", err)
	}

	return &models.AccountInfo{
		ID: id,
		Name: name,
		Username: sess.Username,
		InstituteCode: sess.Institute.InstituteCode,
		InstituteName: sess.Institute.InstituteName,
		IsActive: true,
	}
}

func (s *AccountService) GetActive() *models.StoredAccount {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for i := range s.accounts {
		if s.accounts[i].IsActive {
			cp := s.accounts[i]
			return &cp
		}
	}
	return nil
}

func (s *AccountService) GetAllAccounts() []models.AccountInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]models.AccountInfo, 0, len(s.accounts))
	for _, a := range s.accounts {
		result = append(result, models.AccountInfo{
			ID: a.ID,
			Name: a.Name,
			Username: a.Username,
			InstituteCode: a.Institute.InstituteCode,
			InstituteName: a.Institute.InstituteName,
			IsActive: a.IsActive,
		})
	}
	return result
}

func (s *AccountService) SetActive(id string) error {
	s.mu.Lock()
	found := false
	for i := range s.accounts {
		s.accounts[i].IsActive = (s.accounts[i].ID == id)
		if s.accounts[i].ID == id {
			found = true
		}
	}
	s.mu.Unlock()

	if !found {
		return fmt.Errorf("account not found: %s", id)
	}
	return s.save()
}

func (s *AccountService) Remove(id string) error {
	s.mu.Lock()
	n := len(s.accounts)
	filtered := s.accounts[:0]
	for _, a := range s.accounts {
		if a.ID != id {
			filtered = append(filtered, a)
		}
	}
	s.accounts = filtered
	s.mu.Unlock()

	if len(filtered) == n {
		return fmt.Errorf("account not found: %s", id)
	}
	return s.save()
}

func (s *AccountService) UpdateTokens(id, accessToken, refreshToken string, expiresAt time.Time) {
	s.mu.Lock()
	for i := range s.accounts {
		if s.accounts[i].ID == id {
			s.accounts[i].AccessToken = accessToken
			s.accounts[i].RefreshToken = refreshToken
			s.accounts[i].ExpiresAt = expiresAt
		}
	}
	s.mu.Unlock()
	s.save() //nolint
}

func (s *AccountService) TryRestoreActive(auth *AuthService) {
	stored := s.GetActive()
	if stored == nil {
		return
	}

	sess := &models.Session{
		Institute: stored.Institute,
		Username: stored.Username,
		AccessToken: stored.AccessToken,
		RefreshToken: stored.RefreshToken,
		ExpiresAt: stored.ExpiresAt,
	}

	if sess.IsExpired() {
		log.Println("[AccountService] active session expired, refreshing")
		if err := kreta.RefreshSession(sess); err != nil {
			log.Printf("[AccountService] refresh failed: %v — account needs re-login", err)
			return
		}
		s.UpdateTokens(stored.ID, sess.AccessToken, sess.RefreshToken, sess.ExpiresAt)
	}

	auth.SetSession(sess)
	log.Printf("[AccountService] restored session for %s", stored.Name)
}

func makeID(instituteCode, username string) string {
	return instituteCode + ":" + username
}
