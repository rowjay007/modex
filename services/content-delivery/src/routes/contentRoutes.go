package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/modex/content-delivery/src/handlers"
)

// SetupContentRoutes configures content management routes
func SetupContentRoutes(router *gin.RouterGroup) {
	handler := handlers.NewContentHandler()
	
	content := router.Group("/content")
	{
		// Upload content
		content.POST("", handler.UploadContent)
		
		// Get content list
		content.GET("", handler.GetContents)
		
		// Get specific content
		content.GET("/:id", handler.GetContent)
		
		// Delete content
		content.DELETE("/:id", handler.DeleteContent)
		
		// Generate presigned URL for direct upload
		content.POST("/presigned-url", handler.GeneratePresignedURL)
	}
}