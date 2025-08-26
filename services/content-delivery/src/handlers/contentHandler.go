package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/modex/content-delivery/src/services"
	"github.com/modex/content-delivery/src/utils"
)

type ContentHandler struct {
	contentService *services.ContentService
}

func NewContentHandler() *ContentHandler {
	return &ContentHandler{
		contentService: services.NewContentService(),
	}
}

// UploadContent handles file uploads
func (h *ContentHandler) UploadContent(c *gin.Context) {
	logger := utils.WithRequestID(c.GetHeader("X-Request-ID"))

	// Get user ID from context
	userIDStr, exists := c.Get("user_id")
	if !exists {
		logger.Error("User ID not found in context", nil)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		logger.Error("Invalid user ID format", map[string]interface{}{
			"userID": userIDStr,
			"error":  err.Error(),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	// Parse multipart form
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		logger.Error("Failed to get file from form", map[string]interface{}{
			"error": err.Error(),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	defer file.Close()

	// Parse form data
	title := c.PostForm("title")
	description := c.PostForm("description")
	courseIDStr := c.PostForm("courseId")
	moduleIDStr := c.PostForm("moduleId")
	lessonIDStr := c.PostForm("lessonId")
	isPublic := c.PostForm("isPublic") == "true"
	accessLevel := c.PostForm("accessLevel")
	if accessLevel == "" {
		accessLevel = "private"
	}

	// Parse optional UUIDs
	var courseID, moduleID, lessonID uuid.UUID
	if courseIDStr != "" {
		courseID, _ = uuid.Parse(courseIDStr)
	}
	if moduleIDStr != "" {
		moduleID, _ = uuid.Parse(moduleIDStr)
	}
	if lessonIDStr != "" {
		lessonID, _ = uuid.Parse(lessonIDStr)
	}

	// Create upload request
	req := &services.UploadRequest{
		Title:       title,
		Description: description,
		FileName:    header.Filename,
		FileSize:    header.Size,
		FileType:    header.Header.Get("Content-Type"),
		File:        file,
		OwnerID:     userID,
		CourseID:    courseID,
		ModuleID:    moduleID,
		LessonID:    lessonID,
		IsPublic:    isPublic,
		AccessLevel: accessLevel,
	}

	// Upload content
	content, err := h.contentService.UploadContent(c.Request.Context(), req)
	if err != nil {
		logger.Error("Failed to upload content", map[string]interface{}{
			"error": err.Error(),
			"file":  header.Filename,
		})
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload content"})
		return
	}

	logger.Info("Content uploaded successfully", map[string]interface{}{
		"contentID": content.ID,
		"fileName":  content.FileName,
		"fileSize":  content.FileSize,
	})

	c.JSON(http.StatusCreated, gin.H{
		"message": "content uploaded successfully",
		"content": content,
	})
}

// GetContent retrieves content by ID
func (h *ContentHandler) GetContent(c *gin.Context) {
	logger := utils.WithRequestID(c.GetHeader("X-Request-ID"))

	contentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		logger.Error("Invalid content ID format", map[string]interface{}{
			"contentID": c.Param("id"),
			"error":     err.Error(),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid content ID"})
		return
	}

	content, err := h.contentService.GetContent(c.Request.Context(), contentID)
	if err != nil {
		logger.Error("Content not found", map[string]interface{}{
			"contentID": contentID,
			"error":     err.Error(),
		})
		c.JSON(http.StatusNotFound, gin.H{"error": "content not found"})
		return
	}

	logger.Info("Content retrieved successfully", map[string]interface{}{
		"contentID": content.ID,
		"fileName":  content.FileName,
	})

	c.JSON(http.StatusOK, gin.H{
		"content": content,
	})
}

// GetContents retrieves paginated content list
func (h *ContentHandler) GetContents(c *gin.Context) {
	logger := utils.WithRequestID(c.GetHeader("X-Request-ID"))

	// Get user ID from context
	userIDStr, exists := c.Get("user_id")
	if !exists {
		logger.Error("User ID not found in context", nil)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		logger.Error("Invalid user ID format", map[string]interface{}{
			"userID": userIDStr,
			"error":  err.Error(),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	// Parse pagination parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	offset := (page - 1) * limit

	contents, total, err := h.contentService.GetContentsByOwner(c.Request.Context(), userID, limit, offset)
	if err != nil {
		logger.Error("Failed to get contents", map[string]interface{}{
			"userID": userID,
			"error":  err.Error(),
		})
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get contents"})
		return
	}

	totalPages := (int(total) + limit - 1) / limit

	logger.Info("Contents retrieved successfully", map[string]interface{}{
		"userID":     userID,
		"count":      len(contents),
		"total":      total,
		"page":       page,
		"totalPages": totalPages,
	})

	c.JSON(http.StatusOK, gin.H{
		"contents": contents,
		"pagination": gin.H{
			"page":       page,
			"limit":      limit,
			"total":      total,
			"totalPages": totalPages,
		},
	})
}

// DeleteContent removes content
func (h *ContentHandler) DeleteContent(c *gin.Context) {
	logger := utils.WithRequestID(c.GetHeader("X-Request-ID"))

	contentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		logger.Error("Invalid content ID format", map[string]interface{}{
			"contentID": c.Param("id"),
			"error":     err.Error(),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid content ID"})
		return
	}

	// Get user ID from context
	userIDStr, exists := c.Get("user_id")
	if !exists {
		logger.Error("User ID not found in context", nil)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		logger.Error("Invalid user ID format", map[string]interface{}{
			"userID": userIDStr,
			"error":  err.Error(),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	if err := h.contentService.DeleteContent(c.Request.Context(), contentID, userID); err != nil {
		logger.Error("Failed to delete content", map[string]interface{}{
			"contentID": contentID,
			"userID":    userID,
			"error":     err.Error(),
		})
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete content"})
		return
	}

	logger.Info("Content deleted successfully", map[string]interface{}{
		"contentID": contentID,
		"userID":    userID,
	})

	c.JSON(http.StatusOK, gin.H{
		"message": "content deleted successfully",
	})
}

// GeneratePresignedURL creates a presigned URL for direct upload
func (h *ContentHandler) GeneratePresignedURL(c *gin.Context) {
	logger := utils.WithRequestID(c.GetHeader("X-Request-ID"))

	var req struct {
		FileName    string `json:"fileName" binding:"required"`
		ContentType string `json:"contentType" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Error("Invalid request body", map[string]interface{}{
			"error": err.Error(),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID from context
	userIDStr, exists := c.Get("user_id")
	if !exists {
		logger.Error("User ID not found in context", nil)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		logger.Error("Invalid user ID format", map[string]interface{}{
			"userID": userIDStr,
			"error":  err.Error(),
		})
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	url, err := h.contentService.GeneratePresignedURL(c.Request.Context(), req.FileName, req.ContentType, userID)
	if err != nil {
		logger.Error("Failed to generate presigned URL", map[string]interface{}{
			"error": err.Error(),
			"file":  req.FileName,
		})
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate presigned URL"})
		return
	}

	logger.Info("Presigned URL generated successfully", map[string]interface{}{
		"fileName": req.FileName,
		"userID":   userID,
	})

	c.JSON(http.StatusOK, gin.H{
		"url":       url,
		"expiresIn": 900, // 15 minutes
	})
}
