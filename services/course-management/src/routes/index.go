package routes

import (
	"context"
	"github.com/gin-gonic/gin"
	"github.com/modex/course-management/src/config"
	"github.com/modex/course-management/src/middleware"
	"time"
)

func SetupRoutes(router *gin.Engine) {
	router.Use(middleware.CORS())
	router.Use(middleware.RequestID())
	router.Use(middleware.RateLimit())

	setupHealthRoutes(router)

	api := router.Group("/api/v1")
	{
		SetupCourseRoutes(api)
		SetupModuleRoutes(api)
		SetupLessonRoutes(api)
	}
}

func setupHealthRoutes(router *gin.Engine) {
	// Basic health check
	router.GET("/health", healthCheck)

	router.GET("/health/ready", readinessCheck)
	router.GET("/health/live", livenessCheck)
}

func healthCheck(c *gin.Context) {
	c.JSON(200, gin.H{
		"status":    "healthy",
		"service":   "course-management",
		"timestamp": time.Now().UTC(),
	})
}

func readinessCheck(c *gin.Context) {
	dbStatus := "healthy"
	if err := config.DB.Raw("SELECT 1").Error; err != nil {
		dbStatus = "unhealthy"
	}

	redisStatus := "healthy"
	if _, err := config.RedisClient.Ping(context.Background()).Result(); err != nil {
		redisStatus = "unhealthy"
	}

	c.JSON(200, gin.H{
		"status": "ready",
		"checks": gin.H{
			"database": dbStatus,
			"redis":    redisStatus,
		},
		"timestamp": time.Now().UTC(),
	})
}

func livenessCheck(c *gin.Context) {
	c.JSON(200, gin.H{
		"status":    "alive",
		"service":   "course-management",
		"timestamp": time.Now().UTC(),
		"uptime":    time.Since(startTime),
	})
}

var startTime = time.Now()
