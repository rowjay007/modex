package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/modex/content-delivery/src/handlers"
)

// SetupUploadRoutes configures upload-related routes
func SetupUploadRoutes(router *gin.RouterGroup) {
	handler := handlers.NewContentHandler()
	
	upload := router.Group("/upload")
	{
		// Simple upload endpoint
		upload.POST("", handler.UploadContent)
		
		// Presigned URL generation
		upload.POST("/presigned-url", handler.GeneratePresignedURL)
	}
}
