package kreta

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	htmlpkg "html"
	"io"
	"log"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"regexp"
	"strings"
	"time"
	"ellenorzo/backend/models"
)

func Login(institute models.Institute, username, password string) (*models.Session, error) {
	codeVerifier, codeChallenge, err := generatePKCE()
	if err != nil {
		return nil, fmt.Errorf("PKCE: %w", err)
	}

	code, err := getAuthCode(institute.InstituteCode, username, password, codeChallenge)
	if err != nil {
		return nil, err
	}

	token, err := exchangeCodeForToken(code, codeVerifier)
	if err != nil {
		return nil, err
	}

	return &models.Session{
		Institute: institute,
		Username: username,
		AccessToken: token.AccessToken,
		RefreshToken: token.RefreshToken,
		ExpiresAt: time.Now().Add(time.Duration(token.ExpiresIn) * time.Second),
	}, nil
}

func RefreshSession(session *models.Session) error {
	token, err := requestToken(url.Values{
		"grant_type": {"refresh_token"},
		"refresh_token": {session.RefreshToken},
		"institute_code": {session.Institute.InstituteCode},
		"client_id": {studentClientID},
		"refresh_user_data": {"false"},
	})
	if err != nil {
		return err
	}

	session.AccessToken = token.AccessToken
	if token.RefreshToken != "" {
		session.RefreshToken = token.RefreshToken
	}
	session.ExpiresAt = time.Now().Add(time.Duration(token.ExpiresIn) * time.Second)
	return nil
}

func getAuthCode(instituteCode, username, password, codeChallenge string) (string, error) {
	jar, _ := cookiejar.New(nil)

	var capturedCode string
	idpClient := &http.Client{
		Jar: jar,
		Timeout: 30 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if strings.HasPrefix(req.URL.String(), redirectURI) {
				capturedCode = req.URL.Query().Get("code")
				return http.ErrUseLastResponse
			}
			if len(via) >= 15 {
				return fmt.Errorf("too many redirects")
			}
			return nil
		},
	}

	nonce := randomBase64URL(16)
	state := randomBase64URL(16)
	authURL := idpBase + "/connect/authorize?" + url.Values{
		"prompt": {"login"},
		"nonce": {nonce},
		"response_type": {"code"},
		"code_challenge_method": {"S256"},
		"scope": {oauthScope},
		"code_challenge": {codeChallenge},
		"redirect_uri": {redirectURI},
		"client_id": {studentClientID},
		"state": {state},
	}.Encode()

	req1, _ := http.NewRequest(http.MethodGet, authURL, nil)
	req1.Header.Set("User-Agent", webUserAgent)
	req1.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req1.Header.Set("Accept-Language", "hu-HU,hu;q=0.9")

	resp1, err := idpClient.Do(req1)
	if err != nil {
		return "", fmt.Errorf("authorize page: %w", err)
	}
	defer resp1.Body.Close()

	pageBytes, err := io.ReadAll(resp1.Body)
	if err != nil {
		return "", fmt.Errorf("read login page: %w", err)
	}
	pageHTML := string(pageBytes)

	csrfToken := extractInputValue(pageHTML, "__RequestVerificationToken")
	if csrfToken == "" {
		return "", fmt.Errorf("CSRF token not found in IDP login page")
	}
	returnURL := htmlpkg.UnescapeString(extractInputValue(pageHTML, "ReturnUrl"))

	loginPageURL := resp1.Request.URL.String()
	log.Printf("[kreta] login page: %s", loginPageURL)

	form := url.Values{
		"UserName": {username},
		"Password": {password},
		"InstituteCode": {instituteCode},
		"loginType": {"InstituteLogin"},
		"IsTemporaryLogin": {"False"},
		"ReturnUrl": {returnURL},
		"ClientId": {""},
		"__RequestVerificationToken": {csrfToken},
	}

	req2, _ := http.NewRequest(http.MethodPost, idpBase+"/account/login", strings.NewReader(form.Encode()))
	req2.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req2.Header.Set("User-Agent", webUserAgent)
	req2.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req2.Header.Set("Accept-Language", "hu-HU,hu;q=0.9")
	req2.Header.Set("Referer", loginPageURL)
	req2.Header.Set("Origin", idpBase)

	resp2, err := idpClient.Do(req2)

	if capturedCode != "" {
		if resp2 != nil {
			resp2.Body.Close()
		}
		log.Printf("[kreta] auth code obtained for %s@%s", username, instituteCode)
		return capturedCode, nil
	}
	if err != nil {
		return "", fmt.Errorf("login POST: %w", err)
	}

	defer resp2.Body.Close()
	body2Bytes, _ := io.ReadAll(resp2.Body)
	body2 := string(body2Bytes)

	if consentURL := extractBtnKretaHref(body2); consentURL != "" {
		if !strings.HasPrefix(consentURL, "http") {
			consentURL = idpBase + consentURL
		}
		log.Printf("[kreta] consent page detected, following: %s", consentURL)

		req3, _ := http.NewRequest(http.MethodGet, consentURL, nil)
		req3.Header.Set("User-Agent", webUserAgent)
		req3.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
		req3.Header.Set("Referer", resp2.Request.URL.String())

		resp3, err3 := idpClient.Do(req3)
		if resp3 != nil {
			resp3.Body.Close()
		}

		if capturedCode != "" {
			log.Printf("[kreta] auth code obtained for %s@%s (via consent)", username, instituteCode)
			return capturedCode, nil
		}
		if err3 != nil {
			return "", fmt.Errorf("consent redirect: %w", err3)
		}
		return "", fmt.Errorf("auth code not received after consent page")
	}

	return "", mapIDPError("invalid_grant", "")
}

func exchangeCodeForToken(code, codeVerifier string) (*models.TokenResponse, error) {
	return requestToken(url.Values{
		"grant_type": {"authorization_code"},
		"code": {code},
		"code_verifier": {codeVerifier},
		"redirect_uri": {redirectURI},
		"client_id": {studentClientID},
	})
}

func requestToken(form url.Values) (*models.TokenResponse, error) {
	req, err := http.NewRequest(http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("building token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "*/*")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("IDP request failed: %w", err)
	}
	defer resp.Body.Close()

	var token models.TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return nil, fmt.Errorf("decoding token response: %w", err)
	}

	if token.Error != "" {
		return nil, mapIDPError(token.Error, token.ErrorDescription)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("IDP returned HTTP %d", resp.StatusCode)
	}
	return &token, nil
}

func generatePKCE() (verifier, challenge string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return
	}
	verifier = base64.RawURLEncoding.EncodeToString(b)
	h := sha256.Sum256([]byte(verifier))
	challenge = base64.RawURLEncoding.EncodeToString(h[:])
	return
}

func randomBase64URL(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func extractInputValue(htmlContent, fieldName string) string {
	escaped := regexp.QuoteMeta(fieldName)
	re1 := regexp.MustCompile(`(?i)<input[^>]+name="` + escaped + `"[^>]+value="([^"]*)"`)
	if m := re1.FindStringSubmatch(htmlContent); len(m) >= 2 {
		return m[1]
	}
	re2 := regexp.MustCompile(`(?i)<input[^>]+value="([^"]*)"[^>]+name="` + escaped + `"`)
	if m := re2.FindStringSubmatch(htmlContent); len(m) >= 2 {
		return m[1]
	}
	return ""
}

func extractBtnKretaHref(htmlContent string) string {
	re1 := regexp.MustCompile(`(?i)<a[^>]+class="[^"]*btn-kreta[^"]*"[^>]+href="([^"]+)"`)
	if m := re1.FindStringSubmatch(htmlContent); len(m) >= 2 {
		return htmlpkg.UnescapeString(m[1])
	}
	re2 := regexp.MustCompile(`(?i)<a[^>]+href="([^"]+)"[^>]+class="[^"]*btn-kreta[^"]*"`)
	if m := re2.FindStringSubmatch(htmlContent); len(m) >= 2 {
		return htmlpkg.UnescapeString(m[1])
	}
	return ""
}

func mapIDPError(errCode, desc string) error {
	switch errCode {
	case "invalid_grant":
		return fmt.Errorf("hibás felhasználónév vagy jelszó")
	case "invalid_client":
		return fmt.Errorf("érvénytelen alkalmazás azonosító")
	case "unauthorized_client":
		return fmt.Errorf("nem engedélyezett hozzáférés ehhez az iskolához")
	default:
		if desc != "" {
			return fmt.Errorf("bejelentkezési hiba: %s", desc)
		}
		return fmt.Errorf("bejelentkezési hiba: %s", errCode)
	}
}
