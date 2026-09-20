package kreta

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
	"ellenorzo/backend/models"
)

const (
	idpBase = "https://ujkreta.onrender.com"
	tokenURL = "https://ujkreta.onrender.com/connect/token"
	redirectURI = "https://mobil.e-kreta.hu/ellenorzo-student/prod/oauthredirect"
	studentClientID = "ekrata-ellenorzo-desktop"
	oauthScope = "openid email offline_access kreta-ellenorzo-webapi.public kreta-eugyintezes-webapi.public kreta-fileservice-webapi.public kreta-mobile-global-webapi.public kreta-dkt-webapi.public kreta-ier-webapi.public"
	userAgent = "eKretaStudent/264745 CFNetwork/1494.0.7 Darwin/23.4.0"
	webUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
	globalAPIKey = "21ff6c25-d1da-4a68-a811-c881a6057463"
)

var httpClient = &http.Client{Timeout: 20 * time.Second}

func studentAPIBase(instituteBaseURL string) string {
	return instituteBaseURL + "/ellenorzo/V3"
}

func apiGet(session *models.Session, path string, result interface{}) error {
	reqURL := studentAPIBase(session.Institute.BaseURL()) + path
	req, err := http.NewRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return fmt.Errorf("building request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+session.AccessToken)
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("apiKey", globalAPIKey)
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("érvénytelen vagy lejárt token")
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("API error: HTTP %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(result)
}
