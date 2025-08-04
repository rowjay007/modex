package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/modex/course-management/src/handlers"
	"github.com/modex/course-management/src/middleware"
)

// SetupLessonRoutes configures lesson-related routes
func SetupLessonRoutes(router *gin.RouterGroup) {
	lessonHandler := handlers.NewLessonHandler()
	
	// Public routes
	lessons := router.Group("/lessons")
	{
		lessons.GET("/:id", middleware.ValidateUUID("id"), lessonHandler.GetLesson)
		lessons.GET("/module/:module_id", middleware.ValidateUUID("module_id"), lessonHandler.GetLessonsByModule)
	}

	// Protected routes
	protected := lessons.Group("")
	protected.Use(middleware.AuthRequired(), middleware.InstructorRequired())
	{
		protected.POST("", lessonHandler.CreateLesson)
		protected.PUT("/:id", middleware.ValidateUUID("id"), lessonHandler.UpdateLesson)
		protected.DELETE("/:id", middleware.ValidateUUID("id"), lessonHandler.DeleteLesson)
		protected.POST("/:id/reorder", middleware.ValidateUUID("id"), lessonHandler.ReorderLesson)
	}
}
