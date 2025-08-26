package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/modex/assessment/src/handlers"
)

func SetupAssessmentRoutes(router *gin.RouterGroup) {
	assessmentHandler := handlers.NewAssessmentHandler()

	assessments := router.Group("/assessments")
	{
		assessments.POST("", assessmentHandler.CreateAssessment)
		assessments.GET("/:id", assessmentHandler.GetAssessment)
		assessments.PUT("/:id", assessmentHandler.UpdateAssessment)
		assessments.DELETE("/:id", assessmentHandler.DeleteAssessment)
		
		// Course assessments
		assessments.GET("/course/:courseId", assessmentHandler.GetCourseAssessments)
		
		// Assessment attempts
		assessments.POST("/:id/start", assessmentHandler.StartAssessment)
		assessments.POST("/submissions/:submissionId/submit", assessmentHandler.SubmitAssessment)
		assessments.GET("/submissions/:submissionId", assessmentHandler.GetSubmission)
		assessments.GET("/student/:studentId/assessment/:assessmentId/submissions", assessmentHandler.GetStudentSubmissions)
	}
}