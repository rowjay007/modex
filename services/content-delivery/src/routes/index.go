package routes

import (
	"context"
	"time"

	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/gin-gonic/gin"
	"github.com/modex/content-delivery/src/config"
	"github.com/modex/content-delivery/src/middleware"
)

// SetupRoutes configures all API routes in a centralized manner
func SetupRoutes(router *gin.Engine) {
	// Global middleware
	router.Use(middleware.CORS())
	router.Use(middleware.RequestID())
	router.Use(middleware.RateLimit())
	router.Use(middleware.Auth())

	// Health check endpoints
	setupHealthRoutes(router)

	// API routes
	api := router.Group("/api/v1")
	{
		// Content management routes
		SetupContentRoutes(api)
		
		// Upload routes
		SetupUploadRoutes(api)
		
		// CDN routes
		SetupCDNRoutes(api)
	}

	// Static file serving for direct access
	router.Static("/static", "./uploads")
}

// setupHealthRoutes configures health check endpoints
func setupHealthRoutes(router *gin.Engine) {
	// Basic health check
	router.GET("/health", healthCheck)
	
	// Detailed health check with dependencies
	router.GET("/health/ready", readinessCheck)
	router.GET("/health/live", livenessCheck)
}

// healthCheck provides basic service health status
func healthCheck(c *gin.Context) {
	c.JSON(200, gin.H{
		"status":    "healthy",
		"service":   "content-delivery",
		"timestamp": time.Now().UTC(),
	})
}

// readinessCheck provides detailed health including dependencies
func readinessCheck(c *gin.Context) {
	// Check database connectivity
	dbStatus := "healthy"
	if err := config.DB.Raw("SELECT 1").Error; err != nil {
		dbStatus = "unhealthy"
	}

	// Check Redis connectivity
	redisStatus := "healthy"
	if _, err := config.RedisClient.Ping(context.Background()).Result(); err != nil {
		redisStatus = "unhealthy"
	}

	// Check S3 connectivity
	s3Status := "healthy"
	_, err := config.S3Client.ListBuckets(&s3.ListBucketsInput{})
	if err != nil {
		s3Status = "unhealthy"
	}

	c.JSON(200, gin.H{
		"status": "ready",
		"checks": gin.H{
			"database": dbStatus,
			"redis":    redisStatus,
			"s3":       s3Status,
		},
		"timestamp": time.Now().UTC(),
	})
}

// livenessCheck provides basic service liveness
func livenessCheck(c *gin.Context) {
	c.JSON(200, gin.H{
		"status":    "alive",
		"service":   "content-delivery",
		"timestamp": time.Now().UTC(),
		"uptime":    time.Since(startTime),
	})
}

var startTime = time.Now()
