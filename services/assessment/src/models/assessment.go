package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Assessment represents a quiz, test, or exam
type Assessment struct {
	ID            uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	CourseID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"courseId"`
	ModuleID      *uuid.UUID     `gorm:"type:uuid;index" json:"moduleId,omitempty"`
	Title         string         `gorm:"type:varchar(255);not null" json:"title"`
	Description   string         `gorm:"type:text" json:"description"`
	Instructions  string         `gorm:"type:text" json:"instructions"`
	
	// Assessment configuration
	Type          AssessmentType `gorm:"type:varchar(20);default:'quiz'" json:"type"`
	Status        AssessmentStatus `gorm:"type:varchar(20);default:'draft'" json:"status"`
	Difficulty    DifficultyLevel `gorm:"type:varchar(20);default:'beginner'" json:"difficulty"`
	
	// Timing and attempts
	TimeLimit     int            `gorm:"type:integer;default:0" json:"timeLimit"` // in minutes, 0 = unlimited
	MaxAttempts   int            `gorm:"type:integer;default:1" json:"maxAttempts"`
	PassingScore  float64        `gorm:"type:decimal(5,2);default:70.00" json:"passingScore"`
	
	// Scheduling
	AvailableFrom *time.Time     `gorm:"type:timestamp" json:"availableFrom"`
	AvailableTo   *time.Time     `gorm:"type:timestamp" json:"availableTo"`
	
	// Grading settings
	ShowCorrectAnswers bool       `gorm:"default:true" json:"showCorrectAnswers"`
	ShowScoreOnSubmission bool    `gorm:"default:true" json:"showScoreOnSubmission"`
	RandomizeQuestions bool       `gorm:"default:false" json:"randomizeQuestions"`
	RandomizeOptions  bool        `gorm:"default:false" json:"randomizeOptions"`
	
	// Relationships
	Questions []Question `gorm:"foreignKey:AssessmentID;constraint:OnDelete:CASCADE" json:"questions"`
	Submissions []Submission `gorm:"foreignKey:AssessmentID" json:"submissions,omitempty"`
	
	// Metadata
	CreatedBy uuid.UUID      `gorm:"type:uuid;not null" json:"createdBy"`
	CreatedAt time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"createdAt"`
	UpdatedAt time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deletedAt,omitempty"`
}

// Question represents a single question in an assessment
type Question struct {
	ID           uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	AssessmentID uuid.UUID      `gorm:"type:uuid;not null;index" json:"assessmentId"`
	Type         QuestionType   `gorm:"type:varchar(20);not null" json:"type"`
	Question     string         `gorm:"type:text;not null" json:"question"`
	Explanation  string         `gorm:"type:text" json:"explanation"`
	Points       float64        `gorm:"type:decimal(5,2);default:1.00" json:"points"`
	OrderIndex   int            `gorm:"type:integer;not null" json:"orderIndex"`
	
	// Question configuration
	Required     bool           `gorm:"default:true" json:"required"`
	MediaURL     string         `gorm:"type:varchar(500)" json:"mediaUrl"`
	
	// Relationships
	Options []QuestionOption `gorm:"foreignKey:QuestionID;constraint:OnDelete:CASCADE" json:"options"`
	
	CreatedAt time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"createdAt"`
	UpdatedAt time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deletedAt,omitempty"`
}

// QuestionOption represents answer options for questions
type QuestionOption struct {
	ID         uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	QuestionID uuid.UUID      `gorm:"type:uuid;not null;index" json:"questionId"`
	Text       string         `gorm:"type:text;not null" json:"text"`
	IsCorrect  bool           `gorm:"default:false" json:"isCorrect"`
	OrderIndex int            `gorm:"type:integer;not null" json:"orderIndex"`
	
	CreatedAt time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"createdAt"`
	UpdatedAt time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"updatedAt"`
}

// Submission represents a student's submission
type Submission struct {
	ID           uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	AssessmentID uuid.UUID      `gorm:"type:uuid;not null;index" json:"assessmentId"`
	StudentID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"studentId"`
	AttemptNumber int           `gorm:"type:integer;not null;default:1" json:"attemptNumber"`
	
	// Submission data
	Status       SubmissionStatus `gorm:"type:varchar(20);default:'in_progress'" json:"status"`
	Score        *float64        `gorm:"type:decimal(5,2)" json:"score"`
	MaxScore     float64         `gorm:"type:decimal(5,2);not null" json:"maxScore"`
	Passed       *bool           `json:"passed"`
	
	// Timing
	StartedAt    time.Time       `gorm:"type:timestamp;default:current_timestamp" json:"startedAt"`
	SubmittedAt  *time.Time      `gorm:"type:timestamp" json:"submittedAt"`
	TimeSpent    int             `gorm:"type:integer;default:0" json:"timeSpent"` // in seconds
	
	// Relationships
	Answers []SubmissionAnswer `gorm:"foreignKey:SubmissionID;constraint:OnDelete:CASCADE" json:"answers"`
	
	CreatedAt time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"createdAt"`
	UpdatedAt time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"updatedAt"`
}

// SubmissionAnswer represents a student's answer to a question
type SubmissionAnswer struct {
	ID           uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	SubmissionID uuid.UUID      `gorm:"type:uuid;not null;index" json:"submissionId"`
	QuestionID   uuid.UUID      `gorm:"type:uuid;not null;index" json:"questionId"`
	SelectedOptions []uuid.UUID `gorm:"type:uuid[];serializer:json" json:"selectedOptions"` // For multiple choice
	TextAnswer   string         `gorm:"type:text" json:"textAnswer"` // For text/essay questions
	IsCorrect    *bool          `json:"isCorrect"`
	PointsEarned *float64       `gorm:"type:decimal(5,2)" json:"pointsEarned"`
	
	CreatedAt time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"createdAt"`
	UpdatedAt time.Time      `gorm:"type:timestamp;default:current_timestamp" json:"updatedAt"`
}

// Enums
type AssessmentType string
const (
	AssessmentTypeQuiz       AssessmentType = "quiz"
	AssessmentTypeTest       AssessmentType = "test"
	AssessmentTypeExam       AssessmentType = "exam"
	AssessmentTypeAssignment AssessmentType = "assignment"
	AssessmentTypeSurvey     AssessmentType = "survey"
)

type AssessmentStatus string
const (
	AssessmentStatusDraft     AssessmentStatus = "draft"
	AssessmentStatusPublished AssessmentStatus = "published"
	AssessmentStatusArchived  AssessmentStatus = "archived"
)

type DifficultyLevel string
const (
	DifficultyBeginner    DifficultyLevel = "beginner"
	DifficultyIntermediate DifficultyLevel = "intermediate"
	DifficultyAdvanced    DifficultyLevel = "advanced"
)

type QuestionType string
const (
	QuestionTypeMultipleChoice QuestionType = "multiple_choice"
	QuestionTypeSingleChoice   QuestionType = "single_choice"
	QuestionTypeText           QuestionType = "text"
	QuestionTypeEssay          QuestionType = "essay"
	QuestionTypeTrueFalse      QuestionType = "true_false"
)

type SubmissionStatus string
const (
	SubmissionStatusInProgress SubmissionStatus = "in_progress"
	SubmissionStatusSubmitted  SubmissionStatus = "submitted"
	SubmissionStatusGraded     SubmissionStatus = "graded"
	SubmissionStatusReviewing  SubmissionStatus = "reviewing"
)

// Table names
func (Assessment) TableName() string { return "assessments" }
func (Question) TableName() string { return "questions" }
func (QuestionOption) TableName() string { return "question_options" }
func (Submission) TableName() string { return "submissions" }
func (SubmissionAnswer) TableName() string { return "submission_answers" }
