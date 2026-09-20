package kreta

import (
"encoding/json"
"fmt"
"net/http"
"strings"
"time"

"ellenorzo/backend/models"

)

const (
// ÚjKréta API base URL.
//
// Az ujkreta dokumentációja szerint az API szerver ugyanazokat
// a KRÉTA diák endpointokat emulálja:
//
//   /ellenorzo/v3/sajat/*
//
// Ha az ÚjKréta szervered más domainen fut, ezt az egy értéket
// kell átírni.
apiBaseURL = "https://ujkreta.onrender.com"

tokenURL = apiBaseURL + "/connect/token"

// Az ÚjKréta dokumentáció alapján a password grant közvetlenül
// támogatott, ezért nincs szükség client_id-re, PKCE-re vagy
// authorization-code flow-ra.

userAgent = "eKretaStudent/264745 CFNetwork/1494.0.7 Darwin/23.4.0"

webUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) " +
	"AppleWebKit/605.1.15 (KHTML, like Gecko) " +
	"Version/18.0 Mobile/15E148 Safari/604.1"

)

var httpClient = &http.Client{
Timeout: 20 * time.Second,
}

// studentAPIBase returns the ÚjKréta student API base.
//
// ÚjKréta:
//
//	/ellenorzo/v3/sajat/...
//
// A korábbi kódban V3 szerepelt. Az API dokumentációban v3 szerepel,
// ezért itt pontosan ezt használjuk.
func studentAPIBase() string {
return strings.TrimRight(apiBaseURL, "/") + "/ellenorzo/v3/sajat"
}

// apiGet performs an authenticated GET request against the ÚjKréta
// student API.
func apiGet(
session *models.Session,
path string,
result interface{},
) error {
if session == nil {
return fmt.Errorf("hiányzó session")
}

if strings.TrimSpace(session.AccessToken) == "" {
	return fmt.Errorf("hiányzó access token")
}

path = "/" + strings.TrimLeft(path, "/")

reqURL := studentAPIBase() + path

req, err := http.NewRequest(
	http.MethodGet,
	reqURL,
	nil,
)
if err != nil {
	return fmt.Errorf("kérés létrehozása: %w", err)
}

req.Header.Set(
	"Authorization",
	"Bearer "+session.AccessToken,
)

req.Header.Set("Accept", "application/json")
req.Header.Set("User-Agent", userAgent)

resp, err := httpClient.Do(req)
if err != nil {
	return fmt.Errorf("ÚjKréta API kérés sikertelen: %w", err)
}
defer resp.Body.Close()

if resp.StatusCode == http.StatusUnauthorized {
	return fmt.Errorf("érvénytelen vagy lejárt token")
}

if resp.StatusCode == http.StatusForbidden {
	return fmt.Errorf("nincs jogosultság ehhez az API végponthoz")
}

if resp.StatusCode != http.StatusOK {
	return fmt.Errorf(
		"ÚjKréta API hiba: HTTP %d",
		resp.StatusCode,
	)
}

if result == nil {
	return nil
}

if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
	return fmt.Errorf(
		"ÚjKréta API válasz feldolgozása sikertelen: %w",
		err,
	)
}

return nil

}