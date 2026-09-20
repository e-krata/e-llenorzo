package kreta

import (
"encoding/json"
"fmt"
"net/http"
"net/url"
"strings"
"time"

"ellenorzo/backend/models"

)

// Login authenticates against the ÚjKréta OAuth endpoint.
//
// The ÚjKréta API supports the OAuth2 password grant directly:
//
//	POST /connect/token
//	grant_type=password
//	username=<username>
//	password=<password>
//
// No browser, PKCE or authorization-code flow is required.
func Login(institute models.Institute, username, password string) (*models.Session, error) {
username = strings.TrimSpace(username)

if username == "" {
	return nil, fmt.Errorf("a felhasználónév nem lehet üres")
}

if password == "" {
	return nil, fmt.Errorf("a jelszó nem lehet üres")
}

token, err := requestToken(url.Values{
	"grant_type": {"password"},
	"username":   {username},
	"password":   {password},
})
if err != nil {
	return nil, err
}

if token.AccessToken == "" {
	return nil, fmt.Errorf("a szerver nem adott access tokent")
}

expiresIn := token.ExpiresIn
if expiresIn <= 0 {
	// Az ÚjKréta dokumentáció szerint az alapértelmezett
	// access token élettartam 43200 másodperc.
	expiresIn = 43200
}

return &models.Session{
	Institute:    institute,
	Username:     username,
	AccessToken:  token.AccessToken,
	RefreshToken: token.RefreshToken,
	ExpiresAt:    time.Now().Add(time.Duration(expiresIn) * time.Second),
}, nil

}

// RefreshSession obtains a new access token using the refresh token.
//
// The ÚjKréta API refresh_token grantja:
//
//	POST /connect/token
//	grant_type=refresh_token
//	refresh_token=<refresh token>
func RefreshSession(session *models.Session) error {
if session == nil {
return fmt.Errorf("hiányzó session")
}

if strings.TrimSpace(session.RefreshToken) == "" {
	return fmt.Errorf("nincs refresh token")
}

token, err := requestToken(url.Values{
	"grant_type":   {"refresh_token"},
	"refresh_token": {session.RefreshToken},
})
if err != nil {
	return err
}

if token.AccessToken == "" {
	return fmt.Errorf("a szerver nem adott új access tokent")
}

session.AccessToken = token.AccessToken

if token.RefreshToken != "" {
	session.RefreshToken = token.RefreshToken
}

expiresIn := token.ExpiresIn
if expiresIn <= 0 {
	expiresIn = 43200
}

session.ExpiresAt = time.Now().Add(time.Duration(expiresIn) * time.Second)

return nil

}

// requestToken sends an OAuth token request to ÚjKréta.
func requestToken(form url.Values) (*models.TokenResponse, error) {
req, err := http.NewRequest(
http.MethodPost,
tokenURL,
strings.NewReader(form.Encode()),
)
if err != nil {
return nil, fmt.Errorf("token request létrehozása: %w", err)
}

req.Header.Set(
	"Content-Type",
	"application/x-www-form-urlencoded",
)
req.Header.Set("Accept", "application/json")
req.Header.Set("User-Agent", userAgent)

resp, err := httpClient.Do(req)
if err != nil {
	return nil, fmt.Errorf("ÚjKréta token kérés sikertelen: %w", err)
}
defer resp.Body.Close()

var token models.TokenResponse

if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
	return nil, fmt.Errorf(
		"ÚjKréta token válasz feldolgozása sikertelen: %w",
		err,
	)
}

if token.Error != "" {
	return nil, mapIDPError(
		token.Error,
		token.ErrorDescription,
	)
}

if resp.StatusCode < 200 || resp.StatusCode >= 300 {
	return nil, fmt.Errorf(
		"ÚjKréta token API HTTP %d",
		resp.StatusCode,
	)
}

return &token, nil

}

// mapIDPError converts OAuth errors into user-friendly Hungarian errors.
func mapIDPError(errCode, desc string) error {
switch errCode {
case "invalid_grant":
return fmt.Errorf("hibás felhasználónév vagy jelszó")

case "invalid_client":
	return fmt.Errorf("érvénytelen kliens")

case "unauthorized_client":
	return fmt.Errorf("a kliens nem jogosult erre a műveletre")

case "unsupported_grant_type":
	return fmt.Errorf("a szerver nem támogatja ezt a bejelentkezési módot")

case "invalid_request":
	if desc != "" {
		return fmt.Errorf("hibás bejelentkezési kérés: %s", desc)
	}
	return fmt.Errorf("hibás bejelentkezési kérés")

default:
	if desc != "" {
		return fmt.Errorf("bejelentkezési hiba: %s", desc)
	}

	if errCode != "" {
		return fmt.Errorf("bejelentkezési hiba: %s", errCode)
	}

	return fmt.Errorf("ismeretlen bejelentkezési hiba")
}

}