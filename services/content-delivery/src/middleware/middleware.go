package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/requestid"
	"github.com/gin-gonic/gin"
	"github.com/ulule/limiter/v3"
	limiterGin "github.com/ulule/limiter/v3/drivers/middleware/gin"
	"github.com/ulule/limiter/v3/drivers/store/memory"
	"github.com/modex/content-delivery/src/config"
	"github.com/modex/content-delivery/src/utils"
)

// CORS middleware configuration
func CORS() gin.HandlerFunc {
	return cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Content-Length", "Accept-Encoding", "X-CSRF-Token", "Authorization", "X-Request-ID"},
		ExposeHeaders:    []string{"Content-Length", "X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	})
}

// RequestID middleware adds unique request ID
func RequestID() gin.HandlerFunc {
	return requestid.New()
}

// RateLimit middleware for API rate limiting
func RateLimit() gin.HandlerFunc {
	// Create a rate limiter with 100 requests per minute
	rate := limiter.Rate{
		Period: 1 * time.Minute,
		Limit:  100,
	}
	store := memory.NewStore()
	instance := limiter.New(store, rate)
	
	return limiterGin.NewMiddleware(instance)
}

// Auth middleware for JWT authentication
func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip auth for health check endpoints
		if strings.HasPrefix(c.Request.URL.Path, "/health") {
			c.Next()
			return
		}

		// Check API key for service-to-service communication
		apiKey := c.GetHeader("X-API-Key")
		if apiKey != "" && apiKey == config.Config.APIKey {
			c.Set("service_auth", true)
			c.Next()
			return
		}

		// Check JWT token
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			utils.Error("Missing authorization header", nil)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
			c.Abort()
			return
		}

		// Extract token from Bearer format
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			utils.Error("Invalid authorization header format", nil)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format"})
			c.Abort()
			return
		}

		// Validate JWT token (simplified - implement proper JWT validation)
		userID, err := validateToken(tokenString)
		if err != nil {
			utils.Error("Invalid token", map[string]interface{}{
				"error": err.Error(),
			})
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}

		c.Set("user_id", userID)
		c.Next()
	}
}

// validateToken validates JWT token and returns user ID
func validateToken(tokenString string) (string, error) {
	// TODO: Implement proper JWT validation
	// For now, return a mock user ID
	return "mock-user-id", nil
}

// FileSizeLimit middleware to check file size
func FileSizeLimit(maxSize int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method != "POST" && c.Request.Method != "PUT" {
			c.Next()
			return
		}

		// Check content length
		contentLength := c.Request.Header.Get("Content-Length")
		if contentLength != "" {
			size, err := strconv.ParseInt(contentLength, 10, 64)
			if err != nil {
				utils.Error("Invalid content length", map[string]interface{}{
					"contentLength": contentLength,
				})
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid content length"})
				c.Abort()
				return
			}

			if size > maxSize {
				utils.Error("File too large", map[string]interface{}{
					"size":     size,
					"max_size": maxSize,
				})
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file too large"})
				c.Abort()
				return
			}
		}

		c.Next()
	}
}

// CacheControl middleware for CDN caching
func CacheControl(maxAge time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", fmt.Sprintf("public, max-age=%d", int(maxAge.Seconds())))
		c.Next()
	}
}
