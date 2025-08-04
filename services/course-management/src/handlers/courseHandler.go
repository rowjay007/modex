package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/modex/course-management/src/config"
	"github.com/modex/course-management/src/models"
	"github.com/modex/course-management/src/services"
	"github.com/modex/course-management/src/utils"
	"gorm.io/gorm"
	"net/http"
	"strconv"
	"strings"
)

type CourseHandler struct {
	db            *gorm.DB
	cache         *services.CacheService
	courseService *services.CourseService
}

func NewCourseHandler() *CourseHandler {
	return &CourseHandler{
		db:            config.DB,
		cache:         services.NewCacheService(),
		courseService: services.NewCourseService(),
	}
}

func (h *CourseHandler) CreateCourse(c *gin.Context) {
	var req struct {
		Title       string   `json:"title" binding:"required"`
		Description string   `json:"description"`
		ShortCode   string   `json:"shortCode"`
		Price       float64  `json:"price"`
		Currency    string   `json:"currency"`
		Level       string   `json:"level"`
		Category    string   `json:"category"`
		Language    string   `json:"language"`
		Duration    int      `json:"duration"`
		MaxStudents int      `json:"maxStudents"`
		Thumbnail   string   `json:"thumbnailUrl"`
		Preview     string   `json:"previewUrl"`
		Tags        []string `json:"tags"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	instructorID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user_id not found"})
		return
	}

	instructorUUID, err := uuid.Parse(instructorID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid instructor ID"})
		return
	}

	// Create slug from title
	slug := strings.ToLower(strings.ReplaceAll(req.Title, " ", "-"))

	// Create course
	course := &models.Course{
		Title:        req.Title,
		Description:  req.Description,
		Slug:         slug,
		Category:     req.Category,
		Level:        models.CourseLevel(req.Level),
		Language:     req.Language,
		Duration:     req.Duration,
		Price:        req.Price,
		Currency:     req.Currency,
		MaxStudents:  req.MaxStudents,
		InstructorID: instructorUUID,
		Status:       models.CourseStatusDraft,
		IsPublished:  false,
	}

	if err := h.courseService.CreateCourse(course, req.Tags); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Course created successfully",
		"course":  course,
	})
}

// GetCourse retrieves a course by ID
func (h *CourseHandler) GetCourse(c *gin.Context) {
	courseID := c.Param("id")

	// Validate UUID
	courseUUID, err := uuid.Parse(courseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course ID"})
		return
	}

	// Try to get from cache first
	var course models.Course
	cached, err := h.cache.GetCourse(courseID, &course)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cache error"})
		return
	}

	if !cached {
		// Get from database
		if err := h.db.Preload("Modules.Lessons").Preload("Tags").First(&course, courseUUID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				c.JSON(http.StatusNotFound, gin.H{"error": "course not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Cache the result
		if err := h.cache.SetCourse(courseID, &course); err != nil {
			utils.Error("Failed to cache course", map[string]interface{}{
				"error":    err.Error(),
				"courseID": courseID,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{"course": course})
}

// GetCourses retrieves paginated courses with filtering
func (h *CourseHandler) GetCourses(c *gin.Context) {
	// Get pagination parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	offset := (page - 1) * pageSize

	// Get filter parameters
	category := c.Query("category")
	level := c.Query("level")
	language := c.Query("language")
	status := c.Query("status")
	search := c.Query("search")

	// Build filter
	filter := services.CourseFilter{
		Category: category,
		Level:    level,
		Language: language,
		Status:   status,
		Search:   search,
	}

	// Get courses
	courses, total, err := h.courseService.GetCourses(page, pageSize, offset, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"courses": courses,
		"pagination": gin.H{
			"page":       page,
			"pageSize":   pageSize,
			"total":      total,
			"totalPages": (total + int64(pageSize) - 1) / int64(pageSize),
		},
	})
}

// UpdateCourse updates an existing course
func (h *CourseHandler) UpdateCourse(c *gin.Context) {
	courseID := c.Param("id")

	// Validate UUID
	courseUUID, err := uuid.Parse(courseID)
	if err != nil {
		utils.Error("Failed to parse course ID", map[string]interface{}{
			"error": err.Error(),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course ID"})
		return
	}

	var req struct {
		Title       *string  `json:"title"`
		Description *string  `json:"description"`
		Category    *string  `json:"category"`
		Level       *string  `json:"level"`
		Language    *string  `json:"language"`
		Duration    *int     `json:"duration"`
		Price       *float64 `json:"price"`
		Currency    *string  `json:"currency"`
		MaxStudents *int     `json:"maxStudents"`
		Thumbnail   *string  `json:"thumbnailUrl"`
		Preview     *string  `json:"previewUrl"`
		Tags        []string `json:"tags"`
	}

	utils.Info("Updating course", map[string]interface{}{
		"request": req,
	})

	if err := c.ShouldBindJSON(&req); err != nil {
		utils.Error("Failed to bind course update request", map[string]interface{}{
			"error": err.Error(),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if course exists and user owns it
	var course models.Course
	if err := h.db.Where("id = ? AND instructor_id = ?", courseUUID, c.GetString("user_id")).First(&course).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "course not found or access denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update course fields
	if req.Title != nil {
		course.Title = *req.Title
		course.Slug = strings.ToLower(strings.ReplaceAll(*req.Title, " ", "-"))
	}
	if req.Description != nil {
		course.Description = *req.Description
	}
	if req.Category != nil {
		course.Category = *req.Category
	}
	if req.Level != nil {
		course.Level = models.CourseLevel(*req.Level)
	}
	if req.Language != nil {
		course.Language = *req.Language
	}
	if req.Duration != nil {
		course.Duration = *req.Duration
	}
	if req.Price != nil {
		course.Price = *req.Price
	}
	if req.Currency != nil {
		course.Currency = *req.Currency
	}
	if req.MaxStudents != nil {
		course.MaxStudents = *req.MaxStudents
	}

	if err := h.courseService.UpdateCourse(&course, req.Tags); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Invalidate cache
	h.cache.InvalidateCourse(courseID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Course updated successfully",
		"course":  course,
	})
}

// DeleteCourse deletes a course
func (h *CourseHandler) DeleteCourse(c *gin.Context) {
	courseID := c.Param("id")

	// Validate UUID
	courseUUID, err := uuid.Parse(courseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course ID"})
		return
	}

	// Check if course exists and user owns it
	var course models.Course
	if err := h.db.Where("id = ? AND instructor_id = ?", courseUUID, c.GetString("user_id")).First(&course).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "course not found or access denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := h.courseService.DeleteCourse(courseUUID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Invalidate cache
	h.cache.InvalidateCourse(courseID)

	c.JSON(http.StatusOK, gin.H{"message": "Course deleted successfully"})
}

// PublishCourse publishes a course
func (h *CourseHandler) PublishCourse(c *gin.Context) {
	courseID := c.Param("id")

	// Validate UUID
	courseUUID, err := uuid.Parse(courseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid course ID"})
		return
	}

	// Check if course exists and user owns it
	var course models.Course
	if err := h.db.Where("id = ? AND instructor_id = ?", courseUUID, c.GetString("user_id")).First(&course).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "course not found or access denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Validate course can be published
	if course.Status == models.CourseStatusPublished {
		c.JSON(http.StatusBadRequest, gin.H{"error": "course is already published"})
		return
	}

	// Check if course has at least one module and lesson
	var moduleCount int64
	h.db.Model(&models.Module{}).Where("course_id = ?", courseUUID).Count(&moduleCount)
	if moduleCount == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "course must have at least one module"})
		return
	}

	var lessonCount int64
	h.db.Model(&models.Lesson{}).Where("course_id IN (SELECT id FROM modules WHERE course_id = ?)", courseUUID).Count(&lessonCount)
	if lessonCount == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "course must have at least one lesson"})
		return
	}

	// Publish course
	if err := h.courseService.PublishCourse(courseUUID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Invalidate cache
	h.cache.InvalidateCourse(courseID)

	c.JSON(http.StatusOK, gin.H{"message": "Course published successfully"})
}
