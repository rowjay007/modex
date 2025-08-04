package config

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

var RedisClient *redis.Client
var Ctx = context.Background()

// InitRedis initializes the Redis connection using Upstash
func InitRedis() error {
	redisURL := os.Getenv("UPSTASH_REDIS_REST_URL")
	redisToken := os.Getenv("UPSTASH_REDIS_REST_TOKEN")

	if redisURL == "" || redisToken == "" {
		return fmt.Errorf("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables are required")
	}

	// Parse the URL to extract host and port
	// For Upstash, we'll use the REST API approach
	RedisClient = redis.NewClient(&redis.Options{
		Addr:     "advanced-sunfish-20207.upstash.io:6379",
		Password: redisToken,
		Username: "default",
		TLSConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
		},
	})

	// Test connection
	_, err := RedisClient.Ping(Ctx).Result()
	if err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Println("Redis connection established successfully")
	return nil
}

// CloseRedis closes the Redis connection
func CloseRedis() error {
	if RedisClient == nil {
		return nil
	}
	return RedisClient.Close()
}

// CacheKey generates a consistent cache key
func CacheKey(prefix string, parts ...string) string {
	key := prefix
	for _, part := range parts {
		key += ":" + part
	}
	return key
}

// CacheCourse caches course data
func CacheCourse(courseID string, course interface{}, expiration time.Duration) error {
	key := CacheKey("course", courseID)
	data, err := json.Marshal(course)
	if err != nil {
		return fmt.Errorf("failed to marshal course: %w", err)
	}
	
	return RedisClient.Set(Ctx, key, data, expiration).Err()
}

// GetCachedCourse retrieves cached course data
func GetCachedCourse(courseID string, dest interface{}) (bool, error) {
	key := CacheKey("course", courseID)
	data, err := RedisClient.Get(Ctx, key).Result()
	if err == redis.Nil {
		return false, nil // Cache miss
	}
	if err != nil {
		return false, fmt.Errorf("failed to get cached course: %w", err)
	}
	
	err = json.Unmarshal([]byte(data), dest)
	if err != nil {
		return false, fmt.Errorf("failed to unmarshal cached course: %w", err)
	}
	
	return true, nil
}

// InvalidateCourseCache removes course from cache
func InvalidateCourseCache(courseID string) error {
	key := CacheKey("course", courseID)
	return RedisClient.Del(Ctx, key).Err()
}

// CacheCourseList caches course list data
func CacheCourseList(filter string, courses interface{}, expiration time.Duration) error {
	key := CacheKey("courses", "list", filter)
	data, err := json.Marshal(courses)
	if err != nil {
		return fmt.Errorf("failed to marshal course list: %w", err)
	}
	
	return RedisClient.Set(Ctx, key, data, expiration).Err()
}

// GetCachedCourseList retrieves cached course list
func GetCachedCourseList(filter string, dest interface{}) (bool, error) {
	key := CacheKey("courses", "list", filter)
	data, err := RedisClient.Get(Ctx, key).Result()
	if err == redis.Nil {
		return false, nil // Cache miss
	}
	if err != nil {
		return false, fmt.Errorf("failed to get cached course list: %w", err)
	}
	
	err = json.Unmarshal([]byte(data), dest)
	if err != nil {
		return false, fmt.Errorf("failed to unmarshal cached course list: %w", err)
	}
	
	return true, nil
}
