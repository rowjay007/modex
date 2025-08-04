package middleware

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/requestid"
	"github.com/gin-gonic/gin"
	"github.com/ulule/limiter/v3"
	limitergin "github.com/ulule/limiter/v3/drivers/middleware/gin"
	"github.com/ulule/limiter/v3/drivers/store/memory"
)

func CORS() gin.HandlerFunc {
	return cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Length", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	})
}

func RequestID() gin.HandlerFunc {
	return requestid.New()
}

func RateLimit() gin.HandlerFunc {
	rate, _ := limiter.NewRateFromFormatted("100-M")
	store := memory.NewStore()
	instance := limiter.New(store, rate)
	
	return limitergin.NewMiddleware(instance)
}

func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format"})
			c.Abort()
			return
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token required"})
			c.Abort()
			return
		}

		// TODO: Validate JWT token with user-management service
		// For now, we'll just set a mock user ID
		c.Set("user_id", "mock-user-id")
		c.Set("user_role", "instructor")
		c.Next()
	}
}

func InstructorRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("user_role")
		if !exists || role != "instructor" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Instructor access required"})
			c.Abort()
			return
		}
		c.Next()
	}
}

func Pagination() gin.HandlerFunc {
	return func(c *gin.Context) {
		page := 1
		pageSize := 20

		if p := c.Query("page"); p != "" {
			if parsed, err := strconv.Atoi(p); err == nil && parsed > 0 {
				page = parsed
			}
		}

		if ps := c.Query("page_size"); ps != "" {
			if parsed, err := strconv.Atoi(ps); err == nil && parsed > 0 && parsed <= 100 {
				pageSize = parsed
			}
		}

		offset := (page - 1) * pageSize

		c.Set("page", page)
		c.Set("page_size", pageSize)
		c.Set("offset", offset)
		c.Next()
	}
}

func ErrorHandler() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		if err, ok := recovered.(string); ok {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err,
				"request_id": c.GetString("X-Request-ID"),
			})
		}
		c.AbortWithStatus(http.StatusInternalServerError)
	})
}

func ValidateUUID(param string) gin.HandlerFunc {
	return func(c *gin.Context) {
		uuid := c.Param(param)
		if uuid == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": param + " is required"})
			c.Abort()
			return
		}
		c.Set(param, uuid)
		c.Next()
	}
}
