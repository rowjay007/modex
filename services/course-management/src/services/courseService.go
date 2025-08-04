package services

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/modex/course-management/src/config"
	"github.com/modex/course-management/src/models"
	"gorm.io/gorm"
)

type CourseFilter struct {
	Category string
	Level    string
	Language string
	Status   string
	Search   string
}

type CourseService struct {
	db *gorm.DB
}

func NewCourseService() *CourseService {
	return &CourseService{db: config.DB}
}

func (s *CourseService) CreateCourse(course *models.Course, tags []string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// Generate short code if not provided
		if course.ShortCode == "" {
			course.ShortCode = s.generateShortCode(course.Title)
		}

		// Create course
		if err := tx.Create(course).Error; err != nil {
			return fmt.Errorf("failed to create course: %w", err)
		}

		// Create tags
		if len(tags) > 0 {
			courseTags := make([]models.CourseTag, len(tags))
			for i, tag := range tags {
				courseTags[i] = models.CourseTag{
					CourseID: course.ID,
					Name:     strings.TrimSpace(tag),
				}
			}
			if err := tx.Create(&courseTags).Error; err != nil {
				return fmt.Errorf("failed to create tags: %w", err)
			}
		}

		return nil
	})
}

// GetCourses retrieves courses with pagination and filtering
func (s *CourseService) GetCourses(page, pageSize int, offset int, filter CourseFilter) ([]models.Course, int64, error) {
	var courses []models.Course
	var total int64

	query := s.db.Model(&models.Course{})

	// Apply filters
	if filter.Category != "" {
		query = query.Where("category = ?", filter.Category)
	}
	if filter.Level != "" {
		query = query.Where("level = ?", filter.Level)
	}
	if filter.Language != "" {
		query = query.Where("language = ?", filter.Language)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.Search != "" {
		query = query.Where("title ILIKE ? OR description ILIKE ?", 
			"%"+filter.Search+"%", "%"+filter.Search+"%")
	}

	// Get total count
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count courses: %w", err)
	}

	// Get courses with preloaded relationships
	if err := query.
		Preload("Tags").
		Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&courses).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to get courses: %w", err)
	}

	return courses, total, nil
}

// GetCourseByID retrieves a course by ID
func (s *CourseService) GetCourseByID(id uuid.UUID) (*models.Course, error) {
	var course models.Course
	if err := s.db.Preload("Modules.Lessons").Preload("Tags").Preload("Prerequisites").First(&course, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("course not found")
		}
		return nil, fmt.Errorf("failed to get course: %w", err)
	}
	return &course, nil
}

// UpdateCourse updates an existing course
func (s *CourseService) UpdateCourse(course *models.Course, tags []string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// Update course
		if err := tx.Save(course).Error; err != nil {
			return fmt.Errorf("failed to update course: %w", err)
		}

		// Update tags if provided
		if tags != nil {
			// Delete existing tags
			if err := tx.Where("course_id = ?", course.ID).Delete(&models.CourseTag{}).Error; err != nil {
				return fmt.Errorf("failed to delete existing tags: %w", err)
			}

			// Create new tags
			if len(tags) > 0 {
				courseTags := make([]models.CourseTag, len(tags))
				for i, tag := range tags {
					courseTags[i] = models.CourseTag{
						CourseID: course.ID,
						Name:     strings.TrimSpace(tag),
					}
				}
				if err := tx.Create(&courseTags).Error; err != nil {
					return fmt.Errorf("failed to create tags: %w", err)
				}
			}
		}

		return nil
	})
}

// DeleteCourse deletes a course and its related data
func (s *CourseService) DeleteCourse(id uuid.UUID) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// Check if course exists
		var course models.Course
		if err := tx.First(&course, id).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return fmt.Errorf("course not found")
			}
			return fmt.Errorf("failed to find course: %w", err)
		}

		// Delete related data
		if err := tx.Where("course_id = ?", id).Delete(&models.CourseTag{}).Error; err != nil {
			return fmt.Errorf("failed to delete course tags: %w", err)
		}

		if err := tx.Where("course_id = ?", id).Delete(&models.Prerequisite{}).Error; err != nil {
			return fmt.Errorf("failed to delete prerequisites: %w", err)
		}

		// Delete lessons (will cascade to modules)
		if err := tx.Where("course_id IN (SELECT id FROM modules WHERE course_id = ?)", id).Delete(&models.Lesson{}).Error; err != nil {
			return fmt.Errorf("failed to delete lessons: %w", err)
		}

		// Delete modules
		if err := tx.Where("course_id = ?", id).Delete(&models.Module{}).Error; err != nil {
			return fmt.Errorf("failed to delete modules: %w", err)
		}

		// Delete course
		if err := tx.Delete(&course).Error; err != nil {
			return fmt.Errorf("failed to delete course: %w", err)
		}

		return nil
	})
}

// PublishCourse publishes a course
func (s *CourseService) PublishCourse(id uuid.UUID) error {
	return s.db.Model(&models.Course{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":       models.CourseStatusPublished,
			"is_published": true,
			"published_at": time.Now(),
		}).Error
}

// ArchiveCourse archives a course
func (s *CourseService) ArchiveCourse(id uuid.UUID) error {
	return s.db.Model(&models.Course{}).
		Where("id = ?", id).
		Update("status", models.CourseStatusArchived).Error
}

// AddPrerequisite adds a prerequisite course
func (s *CourseService) AddPrerequisite(courseID, prerequisiteID uuid.UUID) error {
	// Check if both courses exist
	var course, prerequisite models.Course
	if err := s.db.First(&course, courseID).Error; err != nil {
		return fmt.Errorf("course not found: %w", err)
	}
	if err := s.db.First(&prerequisite, prerequisiteID).Error; err != nil {
		return fmt.Errorf("prerequisite course not found: %w", err)
	}

	// Check for circular dependency
	if courseID == prerequisiteID {
		return fmt.Errorf("course cannot be prerequisite of itself")
	}

	// Create prerequisite relationship
	prereq := models.Prerequisite{
		CourseID:       courseID,
		PrerequisiteID: prerequisiteID,
	}

	return s.db.Create(&prereq).Error
}

// RemovePrerequisite removes a prerequisite course
func (s *CourseService) RemovePrerequisite(courseID, prerequisiteID uuid.UUID) error {
	return s.db.Where("course_id = ? AND prerequisite_id = ?", courseID, prerequisiteID).
		Delete(&models.Prerequisite{}).Error
}

// GetCoursesByInstructor retrieves courses by instructor
func (s *CourseService) GetCoursesByInstructor(instructorID uuid.UUID, page, pageSize int) ([]models.Course, int64, error) {
	var courses []models.Course
	var total int64

	offset := (page - 1) * pageSize

	query := s.db.Model(&models.Course{}).Where("instructor_id = ?", instructorID)

	// Get total count
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count courses: %w", err)
	}

	// Get courses
	if err := query.
		Preload("Tags").
		Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&courses).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to get courses: %w", err)
	}

	return courses, total, nil
}

// generateShortCode generates a short code for the course
func (s *CourseService) generateShortCode(title string) string {
	// Simple short code generation - first 3 chars of title + random 4 digits
	words := strings.Fields(title)
	if len(words) > 0 {
		prefix := strings.ToUpper(words[0])
		if len(prefix) > 3 {
			prefix = prefix[:3]
		}
		return prefix + "-" + fmt.Sprintf("%04d", time.Now().UnixNano()%10000)
	}
	return "CRS-" + fmt.Sprintf("%04d", time.Now().UnixNano()%10000)
}

// GetPopularCourses retrieves popular courses based on enrollment count
func (s *CourseService) GetPopularCourses(limit int) ([]models.Course, error) {
	var courses []models.Course
	
	// This would need to be implemented with enrollment service integration
	// For now, return courses ordered by creation date
	if err := s.db.Preload("Tags").
		Where("status = ? AND is_published = ?", models.CourseStatusPublished, true).
		Order("created_at DESC").
		Limit(limit).
		Find(&courses).Error; err != nil {
		return nil, fmt.Errorf("failed to get popular courses: %w", err)
	}
	
	return courses, nil
}
