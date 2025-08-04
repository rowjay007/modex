package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/modex/course-management/src/config"
	"github.com/modex/course-management/src/models"
	"gorm.io/gorm"
	"net/http"
)

type ModuleHandler struct {
	db *gorm.DB
}

func NewModuleHandler() *ModuleHandler {
	return &ModuleHandler{db: config.DB}
}

func (h *ModuleHandler) CreateModule(c *gin.Context) {
	var req struct {
		CourseID    string `json:"courseId" binding:"required"`
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
		OrderIndex  int    `json:"orderIndex"`
		Duration    int    `json:"duration"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	courseUUID, err := uuid.Parse(req.CourseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course ID"})
		return
	}

	var course models.Course
	if err := h.db.Where("id = ? AND instructor_id = ?", courseUUID, c.GetString("user_id")).First(&course).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "course not found or access denied"})
		return
	}

	module := &models.Module{
		CourseID:    courseUUID,
		Title:       req.Title,
		Description: req.Description,
		OrderIndex:  req.OrderIndex,
		Duration:    req.Duration,
	}

	if err := h.db.Create(module).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Module created successfully",
		"module":  module,
	})
}

func (h *ModuleHandler) GetModule(c *gin.Context) {
	moduleID := c.Param("id")

	moduleUUID, err := uuid.Parse(moduleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid module ID"})
		return
	}

	var module models.Module
	if err := h.db.Preload("Lessons").First(&module, moduleUUID).Error; err != nil {
		if err.Error() == "record not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": "module not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"module": module})
}

func (h *ModuleHandler) GetModulesByCourse(c *gin.Context) {
	courseID := c.Param("courseId")

	courseUUID, err := uuid.Parse(courseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course ID"})
		return
	}

	var modules []models.Module
	if err := h.db.Preload("Lessons").Where("course_id = ?", courseUUID).Order("order_index ASC").Find(&modules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"modules": modules})
}

func (h *ModuleHandler) UpdateModule(c *gin.Context) {
	moduleID := c.Param("id")

	moduleUUID, err := uuid.Parse(moduleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid module ID"})
		return
	}

	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
		OrderIndex  *int    `json:"orderIndex"`
		Duration    *int    `json:"duration"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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

	if req.Title != nil {
		module.Title = *req.Title
	}
	if req.Description != nil {
		module.Description = *req.Description
	}
	if req.OrderIndex != nil {
		module.OrderIndex = *req.OrderIndex
	}
	if req.Duration != nil {
		module.Duration = *req.Duration
	}

	if err := h.db.Save(&module).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Module updated successfully",
		"module":  module,
	})
}

func (h *ModuleHandler) DeleteModule(c *gin.Context) {
	moduleID := c.Param("id")

	moduleUUID, err := uuid.Parse(moduleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid module ID"})
		return
	}

	var module models.Module
	if err := h.db.Joins("JOIN courses ON courses.id = modules.course_id").
		Where("modules.id = ? AND courses.instructor_id = ?", moduleUUID, c.GetString("user_id")).
		First(&module).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "module not found or access denied"})
		return
	}

	if err := h.db.Delete(&module).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Module deleted successfully"})
}

func (h *ModuleHandler) ReorderModule(c *gin.Context) {
	moduleID := c.Param("id")

	moduleUUID, err := uuid.Parse(moduleID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid module ID"})
		return
	}

	var req struct {
		OrderIndex int `json:"order_index" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var module models.Module
	if err := h.db.Joins("JOIN courses ON courses.id = modules.course_id").
		Where("modules.id = ? AND courses.instructor_id = ?", moduleUUID, c.GetString("user_id")).
		First(&module).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "module not found or access denied"})
		return
	}

	module.OrderIndex = req.OrderIndex
	if err := h.db.Save(&module).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Module reordered successfully",
		"module":  module,
	})
}
