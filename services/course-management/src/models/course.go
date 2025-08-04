package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Course represents a complete course in the LMS
type Course struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Title       string         `gorm:"type:varchar(255);not null" json:"title"`
	Description string         `gorm:"type:text" json:"description"`
	Slug        string         `gorm:"type:varchar(255);uniqueIndex;not null" json:"slug"`
	ShortCode   string         `gorm:"type:varchar(20);uniqueIndex" json:"shortCode"`
	
	// Course metadata
	Category    string         `gorm:"type:varchar(100)" json:"category"`
	Level       CourseLevel    `gorm:"type:varchar(20);default:'beginner'" json:"level"`
	Language    string         `gorm:"type:varchar(10);default:'en'" json:"language"`
	Duration    int            `gorm:"type:integer;default:0" json:"duration"` // in minutes
	Price       float64        `gorm:"type:decimal(10,2);default:0" json:"price"`
	Currency    string         `gorm:"type:varchar(3);default:'USD'" json:"currency"`
	
	// Course content
	ThumbnailURL string        `gorm:"type:varchar(500)" json:"thumbnailUrl"`
	PreviewVideoURL string     `gorm:"type:varchar(500)" json:"previewVideoUrl"`
	
	// Course status and visibility
	Status      CourseStatus   `gorm:"type:varchar(20);default:'draft'" json:"status"`
	IsPublished bool           `gorm:"default:false" json:"isPublished"`
	PublishedAt *time.Time    `gorm:"type:timestamp" json:"publishedAt"`
	
	// Enrollment settings
	MaxStudents int            `gorm:"type:integer;default:0" json:"maxStudents"` // 0 = unlimited
	EnrollmentDeadline *time.Time `gorm:"type:timestamp" json:"enrollmentDeadline"`
	
	// SEO and marketing
	MetaTitle       string     `gorm:"type:varchar(255)" json:"metaTitle"`
	MetaDescription string     `gorm:"type:varchar(500)" json:"metaDescription"`
	Tags            []CourseTag `gorm:"foreignKey:CourseID" json:"tags"`
	
	// Relationships
	InstructorID uuid.UUID   `gorm:"type:uuid;not null" json:"instructorId"`
	Modules     []Module    `gorm:"foreignKey:CourseID;constraint:OnDelete:CASCADE" json:"modules"`
	Prerequisites []Prerequisite `gorm:"foreignKey:CourseID" json:"prerequisites"`
	
	// Timestamps
	CreatedAt time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"created_at"`
	UpdatedAt time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

// CourseLevel represents the difficulty level of a course
type CourseLevel string

const (
	CourseLevelBeginner    CourseLevel = "beginner"
	CourseLevelIntermediate CourseLevel = "intermediate"
	CourseLevelAdvanced    CourseLevel = "advanced"
	CourseLevelExpert      CourseLevel = "expert"
)

// CourseStatus represents the publishing status of a course
type CourseStatus string

const (
	CourseStatusDraft     CourseStatus = "draft"
	CourseStatusPublished CourseStatus = "published"
	CourseStatusArchived  CourseStatus = "archived"
)

// Module represents a module/section within a course
type Module struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	CourseID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"courseId"`
	Title       string         `gorm:"type:varchar(255);not null" json:"title"`
	Description string         `gorm:"type:text" json:"description"`
	OrderIndex  int            `gorm:"type:integer;not null" json:"order_index"`
	Duration    int            `gorm:"type:integer;default:0" json:"duration"` // in minutes
	
	// Content
	Lessons []Lesson `gorm:"foreignKey:ModuleID;constraint:OnDelete:CASCADE" json:"lessons"`
	
	// Timestamps
	CreatedAt time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"created_at"`
	UpdatedAt time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

// Lesson represents a lesson within a module
type Lesson struct {
	ID          uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	ModuleID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"moduleId"`
	Title       string         `gorm:"type:varchar(255);not null" json:"title"`
	Description string         `gorm:"type:text" json:"description"`
	Content     string         `gorm:"type:text" json:"content"`
	OrderIndex  int            `gorm:"type:integer;not null" json:"order_index"`
	Duration    int            `gorm:"type:integer;default:0" json:"duration"` // in minutes
	
	// Content type and media
	LessonType  LessonType     `gorm:"type:varchar(20);default:'video'" json:"lessonType"`
	VideoURL    string         `gorm:"type:varchar(500)" json:"videoUrl"`
	DownloadURL string         `gorm:"type:varchar(500)" json:"downloadUrl"`
	
	// Timestamps
	CreatedAt time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"created_at"`
	UpdatedAt time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

// LessonType represents the type of lesson content
type LessonType string

const (
	LessonTypeVideo    LessonType = "video"
	LessonTypeText     LessonType = "text"
	LessonTypeQuiz     LessonType = "quiz"
	LessonTypeAssignment LessonType = "assignment"
	LessonTypeLive     LessonType = "live"
)

// CourseTag represents tags for courses
type CourseTag struct {
	ID       uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	CourseID uuid.UUID `gorm:"type:uuid;not null;index" json:"course_id"`
	Name     string    `gorm:"type:varchar(50);not null" json:"name"`
	
	CreatedAt time.Time `gorm:"type:timestamp;default:current_timestamp" json:"created_at"`
}

// Prerequisite represents course prerequisites
type Prerequisite struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	CourseID       uuid.UUID `gorm:"type:uuid;not null;index" json:"course_id"`
	PrerequisiteID uuid.UUID `gorm:"type:uuid;not null" json:"prerequisite_id"`
	
	CreatedAt time.Time `gorm:"type:timestamp;default:current_timestamp" json:"created_at"`
}

// Table names
func (Course) TableName() string {
	return "courses"
}

func (Module) TableName() string {
	return "modules"
}

func (Lesson) TableName() string {
	return "lessons"
}

func (CourseTag) TableName() string {
	return "course_tags"
}

func (Prerequisite) TableName() string {
	return "course_prerequisites"
}
