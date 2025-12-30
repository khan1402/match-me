package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"backend/db"
	"backend/utils"
)

// AuthMiddleware verifies JWT token from cookie
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie("auth_token")
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		claims, err := utils.VerifyToken(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		user, err := db.GetUserByID(claims.UserID)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			c.Abort()
			return
		}

		c.Set("user", user)
		c.Next()
	}
}

// OptionalAuthMiddleware attempts to authenticate but doesn't fail if no token
func OptionalAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie("auth_token")
		if err == nil {
			claims, err := utils.VerifyToken(token)
			if err == nil {
				user, err := db.GetUserByID(claims.UserID)
				if err == nil {
					c.Set("user", user)
				}
			}
		}
		c.Next()
	}
}
