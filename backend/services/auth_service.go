package services

import (
	"fmt"
	"log"
	"sync"

	"ellenorzo/backend/kreta"
	"ellenorzo/backend/models"
)

type AuthService struct {
	mu sync.RWMutex
	session *models.Session
	onRefresh func(*models.Session) 
}

func NewAuthService() *AuthService {
	return &AuthService{}
}

func (s *AuthService) SetOnRefresh(fn func(*models.Session)) {
	s.onRefresh = fn
}

func (s *AuthService) SetSession(sess *models.Session) {
	s.mu.Lock()
	s.session = sess
	s.mu.Unlock()
}

func (s *AuthService) Logout() {
	s.mu.Lock()
	s.session = nil
	s.mu.Unlock()
	log.Println("[AuthService] Session cleared")
}

func (s *AuthService) IsLoggedIn() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.session != nil && !s.session.IsExpired()
}

func (s *AuthService) Session() (*models.Session, error) {
	s.mu.RLock()
	sess := s.session
	s.mu.RUnlock()

	if sess == nil {
		return nil, fmt.Errorf("nincs aktív munkamenet — kérlek jelentkezz be újra")
	}

	if sess.IsExpired() {
		log.Println("[AuthService] Access token expired, refreshing")
		if err := kreta.RefreshSession(sess); err != nil {
			s.mu.Lock()
			s.session = nil
			s.mu.Unlock()
			return nil, fmt.Errorf("token frissítés sikertelen: %w", err)
		}
		log.Println("[AuthService] Token refreshed successfully")
		if s.onRefresh != nil {
			s.onRefresh(sess)
		}
	}

	return sess, nil
}
