package db

import (
	"context"
	"database/sql"
	"fmt"
	"backend/models"
)

func AddUserInterest(userID int, interestID int) error {
	_, err := DB.ExecContext(
		context.Background(),
		`INSERT INTO user_interests (user_id, interest_id)
		 VALUES ($1, $2)
		 ON CONFLICT DO NOTHING`,
		userID, interestID,
	)
	if err != nil {
		return fmt.Errorf("insert user interest: %w", err)
	}
	return nil
}

func ReplaceUserInterests(userID int, interestIDs []int) error {
	tx, err := DB.BeginTx(context.Background(), &sql.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(context.Background(),
		`DELETE FROM user_interests WHERE user_id = $1`, userID,
	); err != nil {
		return fmt.Errorf("delete user interests: %w", err)
	}

	for _, id := range interestIDs {
		if id <= 0 {
			continue
		}
		if _, err := tx.ExecContext(context.Background(),
			`INSERT INTO user_interests (user_id, interest_id)
			 VALUES ($1, $2)
			 ON CONFLICT DO NOTHING`,
			userID, id,
		); err != nil {
			return fmt.Errorf("insert user interest: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}

func UpsertUserPrompt(userID int, promptID int, answer string, displayOrder int) error {
	_, err := DB.ExecContext(
		context.Background(),
		`INSERT INTO user_prompts (user_id, prompt_id, answer, display_order)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id, prompt_id)
		 DO UPDATE SET
		   answer = EXCLUDED.answer,
		   display_order = EXCLUDED.display_order`,
		userID, promptID, answer, displayOrder,
	)
	if err != nil {
		return fmt.Errorf("upsert user prompt: %w", err)
	}
	return nil
}

func ReplaceUserPrompts(userID int, prompts []models.PromptAnswerInput) error {
	tx, err := DB.BeginTx(context.Background(), &sql.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(context.Background(),
		`DELETE FROM user_prompts WHERE user_id = $1`, userID,
	); err != nil {
		return fmt.Errorf("delete user prompts: %w", err)
	}

	for _, p := range prompts {
		if p.PromptID <= 0 {
			continue
		}
		if p.DisplayOrder <= 0 {
			p.DisplayOrder = 1
		}
		if _, err := tx.ExecContext(context.Background(),
			`INSERT INTO user_prompts (user_id, prompt_id, answer, display_order)
			 VALUES ($1, $2, $3, $4)`,
			userID, p.PromptID, p.Answer, p.DisplayOrder,
		); err != nil {
			return fmt.Errorf("insert user prompt: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}

func DeleteUserPrompt(userID int, promptID int) error {
	_, err := DB.ExecContext(
		context.Background(),
		`DELETE FROM user_prompts WHERE user_id = $1 AND prompt_id = $2`,
		userID, promptID,
	)
	if err != nil {
		return fmt.Errorf("delete user prompt: %w", err)
	}
	return nil
}
