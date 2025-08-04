package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/modex/course-management/src/handlers"
	"github.com/modex/course-management/src/middleware"
)

// SetupModuleRoutes configures module-related routes
func SetupModuleRoutes(router *gin.RouterGroup) {
	moduleHandler := handlers.NewModuleHandler()
	
	// Public routes
	modules := router.Group("/modules")
	{
		modules.GET("/:id", middleware.ValidateUUID("id"), moduleHandler.GetModule)
		modules.GET("/course/:course_id", middleware.ValidateUUID("course_id"), moduleHandler.GetModulesByCourse)
	}

	// Protected routes
	protected := modules.Group("")
	protected.Use(middleware.AuthRequired(), middleware.InstructorRequired())
	{
		protected.POST("", moduleHandler.CreateModule)
		protected.PUT("/:id", middleware.ValidateUUID("id"), moduleHandler.UpdateModule)
		protected.DELETE("/:id", middleware.ValidateUUID("id"), moduleHandler.DeleteModule)
		protected.POST("/:id/reorder", middleware.ValidateUUID("id"), moduleHandler.ReorderModule)
	}
}
