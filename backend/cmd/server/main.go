package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"backend/db"
	"backend/handlers"
	"backend/middleware"
	"backend/socket"

	"github.com/gin-gonic/gin"

	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize database
	if err := db.InitDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.CloseDB()

	// ----------------------------
	// Native WebSocket setup
	// ----------------------------
	wsManager := socket.NewWebSocketManager()
	
	// Make WebSocket manager accessible to REST handlers
	handlers.SetWebSocketManager(wsManager)

	// ----------------------------
	// Gin router
	// ----------------------------
	router := gin.Default()

	// CORS middleware (cookie-safe)
	router.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		if origin == "http://localhost:3000" {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		}

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// WebSocket endpoint (outside API group, matches /ws)
	router.GET("/ws", handlers.HandleWebSocket)
	log.Printf("[ROUTES] WebSocket route registered at: GET /ws")

	// Static uploads
	router.Static("/uploads", "./uploads")

	// ----------------------------
	// API group
	// ----------------------------
	api := router.Group("/api")

	// Public meta routes
	api.GET("/prompts", handlers.GetPrompts)
	api.GET("/interests", handlers.GetInterests)

	// Public auth routes
	auth := api.Group("/auth")
	{
		auth.POST("/register", handlers.Register)
		auth.POST("/login", handlers.Login)
		auth.POST("/logout", handlers.Logout)
	}

	// Protected routes
	protected := api.Group("/")
	protected.Use(middleware.AuthMiddleware())
	{
		protected.GET("/me", handlers.GetMe)
		protected.PUT("/me", handlers.UpdateCurrentUser)
		protected.DELETE("/me", handlers.DeleteAccount)

		protected.GET("/me/profile", handlers.GetMyProfile)
		protected.PUT("/me/profile", handlers.UpdateCurrentUserProfile)

		protected.GET("/me/bio", handlers.GetMyBio)
		protected.PUT("/me/bio", handlers.UpdateCurrentUserBio)

		protected.POST("/me/interests", handlers.SaveMyInterests)
		protected.POST("/me/prompts", handlers.SaveMyPrompts)
		protected.DELETE("/me/prompts/:promptId", handlers.DeleteMyPrompt)

		// Photos
		protected.POST("/me/photos", handlers.UploadProfilePhoto)
		protected.GET("/me/photos", handlers.GetMyPhotos)
		protected.DELETE("/me/photos/:id", handlers.DeleteMyPhoto)

		// Users
		protected.GET("/users/:id", handlers.GetUser)
		protected.GET("/users/:id/profile", handlers.GetUserProfile)
		protected.GET("/users/:id/bio", handlers.GetUserBio)
		protected.GET("/users/:id/discovery", handlers.GetUserDiscoveryBio)
		protected.GET("/users/:id/photos", handlers.GetUserPhotos)

		// Recommendations
		protected.GET("/recommendations", handlers.GetRecommendations)
		protected.POST("/recommendations/:userId/like", handlers.LikeUser)
		protected.POST("/recommendations/:userId/pass", handlers.PassUser)
		protected.POST("/recommendations/:userId/dismiss", handlers.DismissUser)

		// Requests / connections
		protected.GET("/connection-requests", handlers.GetConnectionRequests)
		protected.POST("/connection-requests/:userId/accept", handlers.AcceptConnectionRequest)
		protected.POST("/connection-requests/:userId/reject", handlers.RejectConnectionRequest)

		protected.POST("/connections/:userId/request", handlers.SendConnectionRequest)
		protected.POST("/connections/:userId/accept", handlers.AcceptConnectionRequest)
		protected.POST("/connections/:userId/reject", handlers.RejectConnectionRequest)
		protected.DELETE("/connections/:userId", handlers.DisconnectUser)

		// Messages (REST)
		protected.GET("/matches/:matchId/messages", handlers.GetMessages)
		protected.POST("/matches/:matchId/messages", handlers.SendMessage)
		protected.POST("/matches/:matchId/read", handlers.MarkAsRead)
		protected.POST("/matches/:matchId/typing", handlers.Typing)

		// Notifications
		protected.GET("/me/notifications", handlers.GetMyNotifications)
		protected.POST("/me/notifications/:id/read", handlers.MarkNotificationAsRead)

		// Tabs
		protected.GET("/me/likes", handlers.GetMyLikes)
		protected.GET("/matches", handlers.GetMyMatches)
	}

	// ----------------------------
	// HTTP server
	// ----------------------------
	srv := &http.Server{
		Addr:    ":8080",
		Handler: router,
	}

	// Log all registered routes for debugging
	log.Println("[ROUTES] Registered routes:")
	for _, route := range router.Routes() {
		log.Printf("[ROUTES] %s %s -> %s", route.Method, route.Path, route.Handler)
	}

	go func() {
		log.Printf("Starting server on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
