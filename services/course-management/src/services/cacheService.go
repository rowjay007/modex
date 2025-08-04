package services

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/modex/course-management/src/config"
	"github.com/modex/course-management/src/models"
)

// CacheService handles Redis caching operations
type CacheService struct {
	defaultTTL time.Duration
}

// NewCacheService creates a new CacheService
func NewCacheService() *CacheService {
	return &CacheService{
		defaultTTL: 5 * time.Minute,
	}
}

// SetCourse caches a course
func (s *CacheService) SetCourse(courseID string, course *models.Course) error {
	key := fmt.Sprintf("course:%s", courseID)
	data, err := json.Marshal(course)
	if err != nil {
		return fmt.Errorf("failed to marshal course: %w", err)
	}
	
	return config.RedisClient.Set(config.Ctx, key, data, s.defaultTTL).Err()
}

// GetCourse retrieves a cached course
func (s *CacheService) GetCourse(courseID string, dest *models.Course) (bool, error) {
	key := fmt.Sprintf("course:%s", courseID)
	data, err := config.RedisClient.Get(config.Ctx, key).Result()
	if err != nil {
		if err.Error() == "redis: nil" {
			return false, nil // Cache miss
		}
		return false, fmt.Errorf("failed to get course from cache: %w", err)
	}
	
	err = json.Unmarshal([]byte(data), dest)
	if err != nil {
		return false, fmt.Errorf("failed to unmarshal course: %w", err)
	}
	
	return true, nil
}

// InvalidateCourse removes a course from cache
func (s *CacheService) InvalidateCourse(courseID string) error {
	key := fmt.Sprintf("course:%s", courseID)
	return config.RedisClient.Del(config.Ctx, key).Err()
}

// SetCourseList caches a course list
func (s *CacheService) SetCourseList(filter string, courses []models.Course) error {
	key := fmt.Sprintf("courses:list:%s", filter)
	data, err := json.Marshal(courses)
	if err != nil {
		return fmt.Errorf("failed to marshal course list: %w", err)
	}
	
	return config.RedisClient.Set(config.Ctx, key, data, s.defaultTTL).Err()
}

// GetCourseList retrieves a cached course list
func (s *CacheService) GetCourseList(filter string, dest *[]models.Course) (bool, error) {
	key := fmt.Sprintf("courses:list:%s", filter)
	data, err := config.RedisClient.Get(config.Ctx, key).Result()
	if err != nil {
		if err.Error() == "redis: nil" {
			return false, nil // Cache miss
		}
		return false, fmt.Errorf("failed to get course list from cache: %w", err)
	}
	
	err = json.Unmarshal([]byte(data), dest)
	if err != nil {
		return false, fmt.Errorf("failed to unmarshal course list: %w", err)
	}
	
	return true, nil
}

// InvalidateCourseList removes a course list from cache
func (s *CacheService) InvalidateCourseList(filter string) error {
	key := fmt.Sprintf("courses:list:%s", filter)
	return config.RedisClient.Del(config.Ctx, key).Err()
}

// InvalidateAllCourses removes all course-related cache entries
func (s *CacheService) InvalidateAllCourses() error {
	// Use pattern matching to delete all course-related keys
	keys, err := config.RedisClient.Keys(config.Ctx, "course:*").Result()
	if err != nil {
		return fmt.Errorf("failed to get course keys: %w", err)
	}
	
	if len(keys) > 0 {
		return config.RedisClient.Del(config.Ctx, keys...).Err()
	}
	
	return nil
}

// SetPopularCourses caches popular courses
func (s *CacheService) SetPopularCourses(limit int, courses []models.Course) error {
	key := fmt.Sprintf("courses:popular:%d", limit)
	data, err := json.Marshal(courses)
	if err != nil {
		return fmt.Errorf("failed to marshal popular courses: %w", err)
	}
	
	return config.RedisClient.Set(config.Ctx, key, data, s.defaultTTL).Err()
}

// GetPopularCourses retrieves cached popular courses
func (s *CacheService) GetPopularCourses(limit int, dest *[]models.Course) (bool, error) {
	key := fmt.Sprintf("courses:popular:%d", limit)
	data, err := config.RedisClient.Get(config.Ctx, key).Result()
	if err != nil {
		if err.Error() == "redis: nil" {
			return false, nil // Cache miss
		}
		return false, fmt.Errorf("failed to get popular courses from cache: %w", err)
	}
	
	err = json.Unmarshal([]byte(data), dest)
	if err != nil {
		return false, fmt.Errorf("failed to unmarshal popular courses: %w", err)
	}
	
	return true, nil
}
