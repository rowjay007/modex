package services

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/google/uuid"
	"github.com/modex/content-delivery/src/config"
	"github.com/modex/content-delivery/src/models"
	"github.com/modex/content-delivery/src/utils"
	"gorm.io/gorm"
)

type ContentService struct {
	db    *gorm.DB
	redis interface{} // Placeholder for Redis client
	s3    *s3.S3
}

func NewContentService() *ContentService {
	return &ContentService{
		db:    config.DB,
		redis: nil, // Placeholder for Redis client
		s3:    config.S3Client,
	}
}

// UploadContent handles file upload to S3
func (s *ContentService) UploadContent(ctx context.Context, req *UploadRequest) (*models.Content, error) {
	// Validate file type
	if !isAllowedType(req.FileType) {
		return nil, fmt.Errorf("file type %s not allowed", req.FileType)
	}

	// Generate unique filename
	extension := filepath.Ext(req.FileName)
	uniqueFilename := fmt.Sprintf("%s%s", uuid.New().String(), extension)
	s3Key := fmt.Sprintf("content/%s/%s", req.OwnerID, uniqueFilename)

	// Convert io.Reader to io.ReadSeeker for S3 upload
	// In production, handle large files properly
	var fileReader io.ReadSeeker
	if rs, ok := req.File.(io.ReadSeeker); ok {
		fileReader = rs
	} else {
		// For now, return an error - implement proper handling for production
		return nil, fmt.Errorf("file reader does not support seeking required by S3")
	}

	// Upload to S3
	uploadParams := &s3.PutObjectInput{
		Bucket:      aws.String(config.Config.S3Bucket),
		Key:         aws.String(s3Key),
		Body:        fileReader,
		ContentType: aws.String(req.FileType),
		Metadata: map[string]*string{
			"owner_id":   aws.String(req.OwnerID.String()),
			"file_name":  aws.String(req.FileName),
			"uploaded_at": aws.String(time.Now().Format(time.RFC3339)),
		},
	}

	_, err := s.s3.PutObjectWithContext(ctx, uploadParams)
	if err != nil {
		utils.Error("Failed to upload to S3", map[string]interface{}{
			"error":    err.Error(),
			"fileName": req.FileName,
			"ownerID":  req.OwnerID,
		})
		return nil, fmt.Errorf("failed to upload to S3: %w", err)
	}

	// Create content record
	content := &models.Content{
		Title:       req.Title,
		Description: req.Description,
		FileName:    req.FileName,
		FileSize:    req.FileSize,
		FileType:    req.FileType,
		ContentType: getContentType(req.FileType),
		MimeType:    req.FileType,
		OriginalURL: fmt.Sprintf("%s/%s", config.Config.CDNBaseURL, s3Key),
		S3Key:       s3Key,
		S3Bucket:    config.Config.S3Bucket,
		Status:      models.StatusCompleted,
		OwnerID:     req.OwnerID,
		CourseID:    req.CourseID,
		ModuleID:    req.ModuleID,
		LessonID:    req.LessonID,
		IsPublic:    req.IsPublic,
		AccessLevel: req.AccessLevel,
		ProcessedAt: aws.Time(time.Now()),
	}

	if err := s.db.Create(content).Error; err != nil {
		utils.Error("Failed to create content record", map[string]interface{}{
			"error":   err.Error(),
			"content": content,
		})
		return nil, fmt.Errorf("failed to create content record: %w", err)
	}

	// Generate thumbnail for images/videos
	if content.ContentType == models.ContentTypeImage || content.ContentType == models.ContentTypeVideo {
		go s.generateThumbnail(content)
	}

	// Cache the content metadata
	s.cacheContent(content)

	return content, nil
}

// GetContent retrieves content by ID
func (s *ContentService) GetContent(ctx context.Context, contentID uuid.UUID) (*models.Content, error) {
	var content models.Content
	
	// Check cache first
	cacheKey := fmt.Sprintf("content:%s", contentID)
	var cached models.Content
	_ = cacheKey // Placeholder for Redis implementation
	_ = cached   // Placeholder for Redis implementation

	if err := s.db.Preload("Variants").First(&content, "id = ?", contentID).Error; err != nil {
		utils.Error("Content not found", map[string]interface{}{
			"contentID": contentID,
			"error":     err.Error(),
		})
		return nil, fmt.Errorf("content not found: %w", err)
	}

	return &content, nil
}

// GetContentsByOwner retrieves content for a specific owner
func (s *ContentService) GetContentsByOwner(ctx context.Context, ownerID uuid.UUID, limit, offset int) ([]models.Content, int64, error) {
	var contents []models.Content
	var total int64

	query := s.db.Model(&models.Content{}).Where("owner_id = ?", ownerID)
	
	// Get total count
	query.Count(&total)
	
	// Get paginated results
	err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&contents).Error
	if err != nil {
		utils.Error("Failed to get contents by owner", map[string]interface{}{
			"ownerID": ownerID,
			"error":   err.Error(),
		})
		return nil, 0, fmt.Errorf("failed to get contents: %w", err)
	}

	return contents, total, nil
}

// DeleteContent removes content from S3 and database
func (s *ContentService) DeleteContent(ctx context.Context, contentID uuid.UUID, ownerID uuid.UUID) error {
	var content models.Content
	if err := s.db.First(&content, "id = ? AND owner_id = ?", contentID, ownerID).Error; err != nil {
		return fmt.Errorf("content not found or access denied: %w", err)
	}

	// Delete from S3
	_, err := s.s3.DeleteObjectWithContext(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(content.S3Bucket),
		Key:    aws.String(content.S3Key),
	})
	if err != nil {
		utils.Error("Failed to delete from S3", map[string]interface{}{
			"contentID": contentID,
			"error":     err.Error(),
		})
		return fmt.Errorf("failed to delete from S3: %w", err)
	}

	// Delete variants
	var variants []models.ContentVariant
	s.db.Where("content_id = ?", contentID).Find(&variants)
	for _, variant := range variants {
		s.s3.DeleteObjectWithContext(ctx, &s3.DeleteObjectInput{
			Bucket: aws.String(variant.S3Bucket),
			Key:    aws.String(variant.S3Key),
		})
	}

	// Delete from database
	if err := s.db.Delete(&content).Error; err != nil {
		return fmt.Errorf("failed to delete content record: %w", err)
	}

	// Remove from cache
	s.invalidateCache(contentID)

	return nil
}

// GeneratePresignedURL creates a presigned URL for direct upload
func (s *ContentService) GeneratePresignedURL(ctx context.Context, filename string, contentType string, ownerID uuid.UUID) (string, error) {
	extension := filepath.Ext(filename)
	uniqueFilename := fmt.Sprintf("%s%s", uuid.New().String(), extension)
	s3Key := fmt.Sprintf("uploads/%s/%s", ownerID, uniqueFilename)

	req, _ := s.s3.PutObjectRequest(&s3.PutObjectInput{
		Bucket:      aws.String(config.Config.S3Bucket),
		Key:         aws.String(s3Key),
		ContentType: aws.String(contentType),
		Expires:     aws.Time(time.Now().Add(15 * time.Minute)),
	})

	url, err := req.Presign(15 * time.Minute)
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	return url, nil
}

// UploadRequest represents a file upload request
type UploadRequest struct {
	Title       string
	Description string
	FileName    string
	FileSize    int64
	FileType    string
	File        io.Reader
	OwnerID     uuid.UUID
	CourseID    uuid.UUID
	ModuleID    uuid.UUID
	LessonID    uuid.UUID
	IsPublic    bool
	AccessLevel string
}

// Helper functions
func isAllowedType(fileType string) bool {
	allowedTypes := config.Config.AllowedTypes
	for _, allowed := range allowedTypes {
		if fileType == allowed {
			return true
		}
	}
	return false
}

func getContentType(mimeType string) models.ContentType {
	switch {
	case strings.HasPrefix(mimeType, "image/"):
		return models.ContentTypeImage
	case strings.HasPrefix(mimeType, "video/"):
		return models.ContentTypeVideo
	case strings.HasPrefix(mimeType, "audio/"):
		return models.ContentTypeAudio
	case mimeType == "application/pdf":
		return models.ContentTypePDF
	default:
		return models.ContentTypeOther
	}
}

func (s *ContentService) generateThumbnail(content *models.Content) {
	// TODO: Implement thumbnail generation for images/videos
	// This would use FFmpeg for videos or ImageMagick for images
}

func (s *ContentService) cacheContent(content *models.Content) {
	// TODO: Implement Redis caching for content metadata
}

func (s *ContentService) invalidateCache(contentID uuid.UUID) {
	// TODO: Implement cache invalidation
}
