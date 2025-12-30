package db

import (
	"context"
	"fmt"
)

type PromptMeta struct {
	ID       int     `json:"id"`
	Text     string  `json:"text"`
	Category *string `json:"category,omitempty"`
}

type InterestMeta struct {
	ID       int     `json:"id"`
	Name     string  `json:"name"`
	Category *string `json:"category,omitempty"`
}

func GetAllPrompts() ([]PromptMeta, error) {
	rows, err := DB.QueryContext(
		context.Background(),
		`SELECT id, text AS question, NULL::text AS category
		 FROM prompts
		 ORDER BY id`,
	)
	if err != nil {
		return nil, fmt.Errorf("query prompts: %w", err)
	}
	defer rows.Close()

	out := make([]PromptMeta, 0)
	for rows.Next() {
		var p PromptMeta
		if err := rows.Scan(&p.ID, &p.Text, &p.Category); err != nil {
			return nil, fmt.Errorf("scan prompt: %w", err)
		}
		out = append(out, p)
	}

	return out, nil
}

func GetAllInterests() ([]InterestMeta, error) {
	rows, err := DB.QueryContext(
		context.Background(),
		`SELECT id, name, category
		 FROM interests
		 ORDER BY category, name`,
	)
	if err != nil {
		return []InterestMeta{}, fmt.Errorf("query interests: %w", err)
	}
	defer rows.Close()

	out := make([]InterestMeta, 0)
	for rows.Next() {
		var it InterestMeta
		if err := rows.Scan(&it.ID, &it.Name, &it.Category); err != nil {
			return []InterestMeta{}, fmt.Errorf("scan interest: %w", err)
		}
		out = append(out, it)
	}

	return out, nil
}
