package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/modex/assessment/src/config"
	"github.com/modex/assessment/src/models"
	"gorm.io/gorm"
)

type AssessmentService struct {
	db    *gorm.DB
	cache *CacheService
}

func NewAssessmentService() *AssessmentService {
	return &AssessmentService{
		db:    config.DB,
		cache: NewCacheService(),
	}
}

// Assessment CRUD Operations
func (s *AssessmentService) CreateAssessment(assessment *models.Assessment) error {
	if err := s.db.Create(assessment).Error; err != nil {
		return fmt.Errorf("failed to create assessment: %w", err)
	}
	
	// Invalidate cache
	s.cache.DeletePattern(fmt.Sprintf("assessment:course:%s:*", assessment.CourseID))
	return nil
}

func (s *AssessmentService) GetAssessmentByID(id uuid.UUID) (*models.Assessment, error) {
	cacheKey := fmt.Sprintf("assessment:%s", id)
	
	// Try cache first
	if cached, err := s.cache.Get(cacheKey); err == nil {
		var assessment models.Assessment
		if err := json.Unmarshal([]byte(cached), &assessment); err == nil {
			return &assessment, nil
		}
	}
	
	var assessment models.Assessment
	err := s.db.Preload("Questions.Options").Preload("Submissions").
		First(&assessment, "id = ?", id).Error
	
	if err != nil {
		return nil, err
	}
	
	// Cache result
	if data, err := json.Marshal(assessment); err == nil {
		s.cache.Set(cacheKey, string(data), 10*time.Minute)
	}
	
	return &assessment, nil
}

func (s *AssessmentService) GetAssessmentsByCourse(courseID uuid.UUID) ([]models.Assessment, error) {
	cacheKey := fmt.Sprintf("assessment:course:%s", courseID)
	
	var assessments []models.Assessment
	err := s.db.Where("course_id = ? AND deleted_at IS NULL", courseID).
		Order("created_at DESC").Find(&assessments).Error
	
	if err != nil {
		return nil, err
	}
	
	// Cache result
	if data, err := json.Marshal(assessments); err == nil {
		s.cache.Set(cacheKey, string(data), 5*time.Minute)
	}
	
	return assessments, nil
}

func (s *AssessmentService) UpdateAssessment(assessment *models.Assessment) error {
	if err := s.db.Save(assessment).Error; err != nil {
		return fmt.Errorf("failed to update assessment: %w", err)
	}
	
	// Invalidate cache
	s.cache.Delete(fmt.Sprintf("assessment:%s", assessment.ID))
	s.cache.DeletePattern(fmt.Sprintf("assessment:course:%s:*", assessment.CourseID))
	return nil
}

func (s *AssessmentService) DeleteAssessment(id uuid.UUID) error {
	if err := s.db.Delete(&models.Assessment{}, id).Error; err != nil {
		return fmt.Errorf("failed to delete assessment: %w", err)
	}
	
	// Invalidate cache
	s.cache.Delete(fmt.Sprintf("assessment:%s", id))
	return nil
}

// Question Operations
func (s *AssessmentService) AddQuestion(question *models.Question) error {
	return s.db.Create(question).Error
}

func (s *AssessmentService) UpdateQuestion(question *models.Question) error {
	return s.db.Save(question).Error
}

func (s *AssessmentService) DeleteQuestion(id uuid.UUID) error {
	return s.db.Delete(&models.Question{}, id).Error
}

// Submission Operations
func (s *AssessmentService) CreateSubmission(submission *models.Submission) error {
	return s.db.Create(submission).Error
}

func (s *AssessmentService) GetSubmission(id uuid.UUID) (*models.Submission, error) {
	var submission models.Submission
	err := s.db.Preload("Answers").First(&submission, "id = ?", id).Error
	return &submission, err
}

func (s *AssessmentService) GetStudentSubmissions(studentID, assessmentID uuid.UUID) ([]models.Submission, error) {
	var submissions []models.Submission
	err := s.db.Where("student_id = ? AND assessment_id = ?", studentID, assessmentID).
		Order("attempt_number DESC").Find(&submissions).Error
	return submissions, err
}

func (s *AssessmentService) SubmitAssessment(submissionID uuid.UUID, answers []models.SubmissionAnswer) error {
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Save answers
	for _, answer := range answers {
		answer.SubmissionID = submissionID
		if err := tx.Create(&answer).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	// Update submission status and time
	now := time.Now()
	if err := tx.Model(&models.Submission{}).Where("id = ?", submissionID).
		Updates(map[string]interface{}{
			"status":       models.SubmissionStatusSubmitted,
			"submitted_at": &now,
		}).Error; err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit().Error
}

func (s *AssessmentService) GradeSubmission(submissionID uuid.UUID) error {
	var submission models.Submission
	if err := s.db.Preload("Answers").First(&submission, submissionID).Error; err != nil {
		return err
	}

	var assessment models.Assessment
	if err := s.db.Preload("Questions.Options").First(&assessment, submission.AssessmentID).Error; err != nil {
		return err
	}

	totalScore := 0.0
	maxScore := 0.0

	// Create a map for quick question lookup
	questionMap := make(map[uuid.UUID]models.Question)
	for _, question := range assessment.Questions {
		questionMap[question.ID] = question
		maxScore += question.Points
	}

	// Grade each answer
	for _, answer := range submission.Answers {
		question, exists := questionMap[answer.QuestionID]
		if !exists {
			continue
		}

		pointsEarned := s.gradeAnswer(answer, question)
		totalScore += pointsEarned

		// Update answer with points and correctness
		isCorrect := pointsEarned == question.Points
		s.db.Model(&answer).Updates(map[string]interface{}{
			"points_earned": pointsEarned,
			"is_correct":    isCorrect,
		})
	}

	// Update submission with final score
	passed := totalScore >= (maxScore * assessment.PassingScore / 100)
	return s.db.Model(&submission).Updates(map[string]interface{}{
		"score":     totalScore,
		"max_score": maxScore,
		"passed":    passed,
		"status":    models.SubmissionStatusGraded,
	}).Error
}

func (s *AssessmentService) gradeAnswer(answer models.SubmissionAnswer, question models.Question) float64 {
	switch question.Type {
	case models.QuestionTypeSingleChoice, models.QuestionTypeMultipleChoice:
		return s.gradeMultipleChoiceAnswer(answer, question)
	case models.QuestionTypeTrueFalse:
		return s.gradeTrueFalseAnswer(answer, question)
	case models.QuestionTypeText, models.QuestionTypeEssay:
		// Manual grading required - return 0 for now
		return 0.0
	default:
		return 0.0
	}
}

func (s *AssessmentService) gradeMultipleChoiceAnswer(answer models.SubmissionAnswer, question models.Question) float64 {
	correctOptions := make(map[uuid.UUID]bool)
	for _, option := range question.Options {
		if option.IsCorrect {
			correctOptions[option.ID] = true
		}
	}

	selectedCorrect := 0
	selectedIncorrect := 0

	for _, selected := range answer.SelectedOptions {
		if correctOptions[selected] {
			selectedCorrect++
		} else {
			selectedIncorrect++
		}
	}

	// For single choice: all or nothing
	if question.Type == models.QuestionTypeSingleChoice {
		if selectedCorrect == len(correctOptions) && selectedIncorrect == 0 {
			return question.Points
		}
		return 0.0
	}

	// For multiple choice: partial credit
	if len(correctOptions) == 0 {
		return 0.0
	}

	correctRatio := float64(selectedCorrect) / float64(len(correctOptions))
	incorrectPenalty := float64(selectedIncorrect) * 0.5 // 50% penalty per incorrect

	score := correctRatio - incorrectPenalty
	if score < 0 {
		score = 0
	}

	return score * question.Points
}

func (s *AssessmentService) gradeTrueFalseAnswer(answer models.SubmissionAnswer, question models.Question) float64 {
	if len(answer.SelectedOptions) != 1 {
		return 0.0
	}

	for _, option := range question.Options {
		if option.ID == answer.SelectedOptions[0] && option.IsCorrect {
			return question.Points
		}
	}

	return 0.0
}
