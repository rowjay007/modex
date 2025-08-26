package services

import (
	"context"
	"time"

	"github.com/modex/assessment/src/config"
)

type CacheService struct{}

func NewCacheService() *CacheService {
	return &CacheService{}
}

func (s *CacheService) Set(key, value string, expiration time.Duration) error {
	ctx := context.Background()
	return config.RedisClient.Set(ctx, key, value, expiration).Err()
}

func (s *CacheService) Get(key string) (string, error) {
	ctx := context.Background()
	return config.RedisClient.Get(ctx, key).Result()
}

func (s *CacheService) Delete(key string) error {
	ctx := context.Background()
	return config.RedisClient.Del(ctx, key).Err()
}

func (s *CacheService) DeletePattern(pattern string) error {
	ctx := context.Background()
	keys, err := config.RedisClient.Keys(ctx, pattern).Result()
	if err != nil {
		return err
	}
	
	if len(keys) > 0 {
		return config.RedisClient.Del(ctx, keys...).Err()
	}
	
	return nil
}
