package kreta

import (
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"ellenorzo/backend/models"
)

const instituteSearchBase = "https://ujkreta.onrender.com/InstituteSearch"

var (
	dataValRe  = regexp.MustCompile(`data-val="([^"]+)"`)
	linkTextRe = regexp.MustCompile(`>([^<]+)</a>`)
)

func SearchInstitutes(query string) ([]models.Institute, error) {
	if strings.TrimSpace(query) == "" {
		return nil, nil
	}

	searchURL := fmt.Sprintf("%s/%s?showOnlyLive=true",
		instituteSearchBase, url.PathEscape(query))

	req, err := http.NewRequest(http.MethodGet, searchURL, nil)
	if err != nil {
		return nil, fmt.Errorf("request: %w", err)
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "text/html")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 256))
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read: %w", err)
	}

	institutes := parseInstituteHTML(string(body))
	log.Printf("[kreta] SearchInstitutes(%q) → %d results", query, len(institutes))
	return institutes, nil
}

func parseInstituteHTML(htmlContent string) []models.Institute {
	codes := dataValRe.FindAllStringSubmatch(htmlContent, -1)
	texts := linkTextRe.FindAllStringSubmatch(htmlContent, -1)

	n := len(codes)
	if len(texts) < n {
		n = len(texts)
	}

	institutes := make([]models.Institute, 0, n)
	for i := 0; i < n; i++ {
		code := codes[i][1]
		rawText := html.UnescapeString(texts[i][1])

		name := rawText
		if idx := strings.LastIndex(rawText, " ("); idx > 0 {
			name = strings.TrimSpace(rawText[:idx])
		}

		institutes = append(institutes, models.Institute{
			InstituteCode: code,
			InstituteName: name,
		})
	}
	return institutes
}
