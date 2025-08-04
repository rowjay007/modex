package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/modex/course-management/src/handlers"
	"github.com/modex/course-management/src/middleware"
)

// SetupCourseRoutes configures course-related routes
func SetupCourseRoutes(router *gin.RouterGroup) {
	courseHandler := handlers.NewCourseHandler()
	
	// Public routes
	courses := router.Group("/courses")
	{
		courses.GET("", middleware.Pagination(), courseHandler.GetCourses)
		courses.GET("/:id", middleware.ValidateUUID("id"), courseHandler.GetCourse)
	}

	// Protected routes (require authentication)
	protected := courses.Group("")
	protected.Use(middleware.AuthRequired())
	{
		// Instructor-only routes
		instructor := protected.Group("")
		instructor.Use(middleware.InstructorRequired())
		{
			instructor.POST("", courseHandler.CreateCourse)
			instructor.PUT("/:id", middleware.ValidateUUID("id"), courseHandler.UpdateCourse)
			instructor.DELETE("/:id", middleware.ValidateUUID("id"), courseHandler.DeleteCourse)
			instructor.POST("/:id/publish", middleware.ValidateUUID("id"), courseHandler.PublishCourse)
		}
	}
}
