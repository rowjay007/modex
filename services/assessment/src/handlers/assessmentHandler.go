package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/modex/assessment/src/models"
	"github.com/modex/assessment/src/services"
)

type AssessmentHandler struct {
	assessmentService *services.AssessmentService
}

func NewAssessmentHandler() *AssessmentHandler {
	return &AssessmentHandler{
		assessmentService: services.NewAssessmentService(),
	}
}

// CreateAssessment creates a new assessment
func (h *AssessmentHandler) CreateAssessment(c *gin.Context) {
	var assessment models.Assessment
	if err := c.ShouldBindJSON(&assessment); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.assessmentService.CreateAssessment(&assessment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": assessment})
}

// GetAssessment retrieves an assessment by ID
func (h *AssessmentHandler) GetAssessment(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assessment ID"})
		return
	}

	assessment, err := h.assessmentService.GetAssessmentByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Assessment not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": assessment})
}

// GetCourseAssessments retrieves all assessments for a course
func (h *AssessmentHandler) GetCourseAssessments(c *gin.Context) {
	courseID, err := uuid.Parse(c.Param("courseId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid course ID"})
		return
	}

	assessments, err := h.assessmentService.GetAssessmentsByCourse(courseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": assessments})
}

// UpdateAssessment updates an existing assessment
func (h *AssessmentHandler) UpdateAssessment(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assessment ID"})
		return
	}

	var assessment models.Assessment
	if err := c.ShouldBindJSON(&assessment); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	assessment.ID = id
	if err := h.assessmentService.UpdateAssessment(&assessment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": assessment})
}

// DeleteAssessment deletes an assessment
func (h *AssessmentHandler) DeleteAssessment(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assessment ID"})
		return
	}

	if err := h.assessmentService.DeleteAssessment(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// StartAssessment creates a new submission for a student
func (h *AssessmentHandler) StartAssessment(c *gin.Context) {
	assessmentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assessment ID"})
		return
	}

	var req struct {
		StudentID uuid.UUID `json:"studentId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check existing attempts
	existing, _ := h.assessmentService.GetStudentSubmissions(req.StudentID, assessmentID)
	
	submission := models.Submission{
		AssessmentID:  assessmentID,
		StudentID:     req.StudentID,
		AttemptNumber: len(existing) + 1,
		Status:        models.SubmissionStatusInProgress,
	}

	if err := h.assessmentService.CreateSubmission(&submission); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": submission})
}

// SubmitAssessment submits answers for an assessment
func (h *AssessmentHandler) SubmitAssessment(c *gin.Context) {
	submissionID, err := uuid.Parse(c.Param("submissionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid submission ID"})
		return
	}

	var req struct {
		Answers []models.SubmissionAnswer `json:"answers" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.assessmentService.SubmitAssessment(submissionID, req.Answers); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Auto-grade if possible
	go func() {
		h.assessmentService.GradeSubmission(submissionID)
	}()

	c.JSON(http.StatusOK, gin.H{"message": "Assessment submitted successfully"})
}

// GetSubmission retrieves a submission by ID
func (h *AssessmentHandler) GetSubmission(c *gin.Context) {
	submissionID, err := uuid.Parse(c.Param("submissionId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid submission ID"})
		return
	}

	submission, err := h.assessmentService.GetSubmission(submissionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Submission not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": submission})
}

// GetStudentSubmissions retrieves all submissions for a student
func (h *AssessmentHandler) GetStudentSubmissions(c *gin.Context) {
	studentID, err := uuid.Parse(c.Param("studentId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid student ID"})
		return
	}

	assessmentID, err := uuid.Parse(c.Param("assessmentId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid assessment ID"})
		return
	}

	submissions, err := h.assessmentService.GetStudentSubmissions(studentID, assessmentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": submissions})
}