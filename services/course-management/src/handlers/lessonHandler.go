package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/modex/course-management/src/config"
	"github.com/modex/course-management/src/models"
	"gorm.io/gorm"
)

// LessonHandler handles lesson-related HTTP requests
type LessonHandler struct {
	db *gorm.DB
}

// NewLessonHandler creates a new LessonHandler
func NewLessonHandler() *LessonHandler {
	return &LessonHandler{db: config.DB}
}

// CreateLesson creates a new lesson
func (h *LessonHandler) CreateLesson(c *gin.Context) {
	var req struct {
		ModuleID    string `json:"moduleId" binding:"required"`
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
		Content     string `json:"content"`
		OrderIndex  int    `json:"orderIndex"`
		Duration    int    `json:"duration"`
		LessonType  string `json:"lessonType"`
		VideoURL    string `json:"videoUrl"`
		DownloadURL string `json:"downloadUrl"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate UUIDs
	moduleUUID, err := uuid.Parse(req.ModuleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid module ID"})
		return
	}

	// Check if module exists and user owns the course
	var module models.Module
	if err := h.db.Joins("JOIN courses ON courses.id = modules.course_id").
		Where("modules.id = ? AND courses.instructor_id = ?", moduleUUID, c.GetString("user_id")).
		First(&module).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "module not found or access denied"})
		return
	}

	// Create lesson
	lesson := &models.Lesson{
		ModuleID:    moduleUUID,
		Title:       req.Title,
		Description: req.Description,
		Content:     req.Content,
		OrderIndex:  req.OrderIndex,
		Duration:    req.Duration,
		LessonType:  models.LessonType(req.LessonType),
		VideoURL:    req.VideoURL,
		DownloadURL: req.DownloadURL,
	}

	if err := h.db.Create(lesson).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Lesson created successfully",
		"lesson":  lesson,
	})
}

// GetLesson retrieves a lesson by ID
func (h *LessonHandler) GetLesson(c *gin.Context) {
	lessonID := c.Param("id")
	
	lessonUUID, err := uuid.Parse(lessonID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid lesson ID"})
		return
	}

	var lesson models.Lesson
	if err := h.db.First(&lesson, lessonUUID).Error; err != nil {
		if err.Error() == "record not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "lesson not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"lesson": lesson})
}

// GetLessonsByModule retrieves all lessons for a module
func (h *LessonHandler) GetLessonsByModule(c *gin.Context) {
	moduleID := c.Param("moduleId")
	
	moduleUUID, err := uuid.Parse(moduleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid module ID"})
		return
	}

	var lessons []models.Lesson
	if err := h.db.Where("module_id = ?", moduleUUID).Order("order_index ASC").Find(&lessons).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"lessons": lessons})
}

// UpdateLesson updates an existing lesson
func (h *LessonHandler) UpdateLesson(c *gin.Context) {
	lessonID := c.Param("id")
	
	lessonUUID, err := uuid.Parse(lessonID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid lesson ID"})
		return
	}

	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
		Content     *string `json:"content"`
		OrderIndex  *int    `json:"orderIndex"`
		Duration    *int    `json:"duration"`
		LessonType  *string `json:"lessonType"`
		VideoURL    *string `json:"videoUrl"`
		DownloadURL *string `json:"downloadUrl"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if lesson exists and user owns the course
	var lesson models.Lesson
	if err := h.db.Joins("JOIN modules ON modules.id = lessons.module_id").
		Joins("JOIN courses ON courses.id = modules.course_id").
		Where("lessons.id = ? AND courses.instructor_id = ?", lessonUUID, c.GetString("user_id")).
		First(&lesson).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "lesson not found or access denied"})
		return
	}

	// Update lesson fields
	if req.Title != nil {
		lesson.Title = *req.Title
	}
	if req.Description != nil {
		lesson.Description = *req.Description
	}
	if req.Content != nil {
		lesson.Content = *req.Content
	}
	if req.OrderIndex != nil {
		lesson.OrderIndex = *req.OrderIndex
	}
	if req.Duration != nil {
		lesson.Duration = *req.Duration
	}
	if req.LessonType != nil {
		lesson.LessonType = models.LessonType(*req.LessonType)
	}
	if req.VideoURL != nil {
		lesson.VideoURL = *req.VideoURL
	}
	if req.DownloadURL != nil {
		lesson.DownloadURL = *req.DownloadURL
	}

	if err := h.db.Save(&lesson).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Lesson updated successfully",
		"lesson":  lesson,
	})
}

// DeleteLesson deletes a lesson
func (h *LessonHandler) DeleteLesson(c *gin.Context) {
	lessonID := c.Param("id")
	
	lessonUUID, err := uuid.Parse(lessonID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid lesson ID"})
		return
	}

	// Check if lesson exists and user owns the course
	var lesson models.Lesson
	if err := h.db.Joins("JOIN modules ON modules.id = lessons.module_id").
		Joins("JOIN courses ON courses.id = modules.course_id").
		Where("lessons.id = ? AND courses.instructor_id = ?", lessonUUID, c.GetString("user_id")).
		First(&lesson).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "lesson not found or access denied"})
		return
	}

	if err := h.db.Delete(&lesson).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Lesson deleted successfully"})
}

// ReorderLesson updates the order index of a lesson
func (h *LessonHandler) ReorderLesson(c *gin.Context) {
	lessonID := c.Param("id")
	
	lessonUUID, err := uuid.Parse(lessonID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid lesson ID"})
		return
	}

	var req struct {
		OrderIndex int `json:"order_index" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if lesson exists and user owns the course
	var lesson models.Lesson
	if err := h.db.Joins("JOIN modules ON modules.id = lessons.module_id").
		Joins("JOIN courses ON courses.id = modules.course_id").
		Where("lessons.id = ? AND courses.instructor_id = ?", lessonUUID, c.GetString("user_id")).
		First(&lesson).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "lesson not found or access denied"})
		return
	}

	lesson.OrderIndex = req.OrderIndex
	if err := h.db.Save(&lesson).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Lesson reordered successfully",
		"lesson":  lesson,
	})
}
