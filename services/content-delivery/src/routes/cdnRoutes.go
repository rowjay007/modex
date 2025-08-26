package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/modex/content-delivery/src/handlers"
)

// SetupCDNRoutes configures CDN and streaming routes
func SetupCDNRoutes(router *gin.RouterGroup) {
	handler := handlers.NewContentHandler()
	
	cdn := router.Group("/cdn")
	{
		// Direct content access via content ID
		cdn.GET("/content/:id", handler.GetContent)
		
		// Public content access
		cdn.GET("/public/:id", handler.GetContent)
	}
}
