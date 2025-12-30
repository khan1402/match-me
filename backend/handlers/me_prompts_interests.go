package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"backend/db"
	"backend/models"
)

// POST /api/me/interests
// Supports BOTH payloads:
// 1) { "interestId": 12 }  (what your current frontend likely does via addInterest(id))
// 2) { "interestIds": [1,2,3] } (future-proof: replace all)
func SaveMyInterests(c *gin.Context) {
	userAny, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	user, ok := userAny.(*models.User)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req struct {
		InterestID  *int   `json:"interestId"`
		InterestIDs []int  `json:"interestIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}

	// Bulk replace mode (optional)
	if len(req.InterestIDs) > 0 {
		if err := db.ReplaceUserInterests(user.ID, req.InterestIDs); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save interests"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}

	// Single insert mode
	if req.InterestID == nil || *req.InterestID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "interestId is required"})
		return
	}

	if err := db.AddUserInterest(user.ID, *req.InterestID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save interest"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// POST /api/me/prompts
// Supports BOTH payloads:
// 1) { "promptId": 5, "answer": "....", "displayOrder": 1 } (what your current frontend does)
// 2) { "prompts": [ ... ] } (future-proof)
func SaveMyPrompts(c *gin.Context) {
	userAny, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	user, ok := userAny.(*models.User)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Try “single prompt” payload first
	var single struct {
		PromptID      int    `json:"promptId"`
		Answer        string `json:"answer"`
		DisplayOrder  int    `json:"displayOrder"`
	}
	if err := c.ShouldBindJSON(&single); err == nil && single.PromptID != 0 {
		answer := strings.TrimSpace(single.Answer)
		if answer == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "answer is required"})
			return
		}
		if single.DisplayOrder <= 0 {
			single.DisplayOrder = 1
		}

		if err := db.UpsertUserPrompt(user.ID, single.PromptID, answer, single.DisplayOrder); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save prompt"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"ok": true})
		return
	}

	// If not single, attempt bulk payload
	var bulk struct {
	Prompts []models.PromptAnswerInput `json:"prompts"`	
	}


	if err := c.ShouldBindJSON(&bulk); err != nil || len(bulk.Prompts) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	if err := db.ReplaceUserPrompts(user.ID, bulk.Prompts); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save prompts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// DELETE /api/me/prompts/:promptId
func DeleteMyPrompt(c *gin.Context) {
	userAny, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	user, ok := userAny.(*models.User)
	if !ok || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	promptID, err := strconv.Atoi(c.Param("promptId"))
	if err != nil || promptID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid promptId"})
		return
	}

	if err := db.DeleteUserPrompt(user.ID, promptID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete prompt"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
