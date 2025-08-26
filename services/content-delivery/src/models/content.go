package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ContentType represents the type of content

type ContentType string

const (
	ContentTypeImage   ContentType = "image"
	ContentTypeVideo   ContentType = "video"
	ContentTypeAudio   ContentType = "audio"
	ContentTypePDF     ContentType = "pdf"
	ContentTypeOther   ContentType = "other"
)

// ContentStatus represents the processing status

type ContentStatus string

const (
	StatusPending    ContentStatus = "pending"
	StatusProcessing ContentStatus = "processing"
	StatusCompleted  ContentStatus = "completed"
	StatusFailed     ContentStatus = "failed"
)

// Content represents a file or media asset

type Content struct {
	ID          uuid.UUID     `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Title       string        `gorm:"type:varchar(255);not null" json:"title"`
	Description string        `gorm:"type:text" json:"description"`
	FileName    string        `gorm:"type:varchar(255);not null" json:"fileName"`
	FileSize    int64         `gorm:"type:bigint;not null" json:"fileSize"`
	FileType    string        `gorm:"type:varchar(100);not null" json:"fileType"`
	ContentType ContentType   `gorm:"type:varchar(20);not null" json:"contentType"`
	MimeType    string        `gorm:"type:varchar(100);not null" json:"mimeType"`
	
	// Storage information
	OriginalURL string        `gorm:"type:varchar(500);not null" json:"originalUrl"`
	ThumbnailURL string       `gorm:"type:varchar(500)" json:"thumbnailUrl"`
	S3Key       string        `gorm:"type:varchar(500);not null" json:"s3Key"`
	S3Bucket    string        `gorm:"type:varchar(255);not null" json:"s3Bucket"`
	
	// Processing information
	Status      ContentStatus `gorm:"type:varchar(20);default:'pending'" json:"status"`
	ProcessingError string    `gorm:"type:text" json:"processingError,omitempty"`
	
	// Metadata
	Duration    int           `gorm:"type:integer;default:0" json:"duration"` // For videos/audio
	Width       int           `gorm:"type:integer;default:0" json:"width"`   // For images/videos
	Height      int           `gorm:"type:integer;default:0" json:"height"`  // For images/videos
	
	// Ownership
	OwnerID     uuid.UUID     `gorm:"type:uuid;not null" json:"ownerId"`
	CourseID    uuid.UUID     `gorm:"type:uuid" json:"courseId,omitempty"`
	ModuleID    uuid.UUID     `gorm:"type:uuid" json:"moduleId,omitempty"`
	LessonID    uuid.UUID     `gorm:"type:uuid" json:"lessonId,omitempty"`
	
	// Access control
	IsPublic    bool          `gorm:"default:false" json:"isPublic"`
	AccessLevel string        `gorm:"type:varchar(20);default:'private'" json:"accessLevel"`
	
	// Timestamps
	CreatedAt   time.Time     `gorm:"type:timestamp;default:current_timestamp" json:"createdAt"`
	UpdatedAt   time.Time     `gorm:"type:timestamp;default:current_timestamp" json:"updatedAt"`
	ProcessedAt *time.Time    `gorm:"type:timestamp" json:"processedAt,omitempty"`
	
	// Relationships
	Variants []ContentVariant `gorm:"foreignKey:ContentID" json:"variants,omitempty"`
}

// ContentVariant represents different versions/formats of content
type ContentVariant struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ContentID uuid.UUID `gorm:"type:uuid;not null" json:"contentId"`
	
	// Variant information
	VariantType string    `gorm:"type:varchar(50);not null" json:"variantType"` // thumbnail, preview, hd, sd
	FileName    string    `gorm:"type:varchar(255);not null" json:"fileName"`
	FileSize    int64     `gorm:"type:bigint;not null" json:"fileSize"`
	FileType    string    `gorm:"type:varchar(100);not null" json:"fileType"`
	
	// Storage information
	S3Key    string `gorm:"type:varchar(500);not null" json:"s3Key"`
	S3Bucket string `gorm:"type:varchar(255);not null" json:"s3Bucket"`
	URL      string `gorm:"type:varchar(500);not null" json:"url"`
	
	// Dimensions
	Width  int `gorm:"type:integer;default:0" json:"width"`
	Height int `gorm:"type:integer;default:0" json:"height"`
	
	// Timestamps
	CreatedAt time.Time `gorm:"type:timestamp;default:current_timestamp" json:"createdAt"`
	UpdatedAt time.Time `gorm:"type:timestamp;default:current_timestamp" json:"updatedAt"`
}

// UploadSession represents a temporary upload session
type UploadSession struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null" json:"userId"`
	
	// Upload information
	FileName  string    `gorm:"type:varchar(255);not null" json:"fileName"`
	FileSize  int64     `gorm:"type:bigint;not null" json:"fileSize"`
	FileType  string    `gorm:"type:varchar(100);not null" json:"fileType"`
	
	// Session management
	SessionID string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"sessionId"`
	ExpiresAt time.Time `gorm:"type:timestamp;not null" json:"expiresAt"`
	
	// Upload progress
	UploadedBytes int64  `gorm:"type:bigint;default:0" json:"uploadedBytes"`
	Status        string `gorm:"type:varchar(20);default:'active'" json:"status"`
	
	// Timestamps
	CreatedAt time.Time `gorm:"type:timestamp;default:current_timestamp" json:"createdAt"`
	UpdatedAt time.Time `gorm:"type:timestamp;default:current_timestamp" json:"updatedAt"`
}

// BeforeCreate hooks for GORM
func (c *Content) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

func (c *ContentVariant) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

func (u *UploadSession) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}
