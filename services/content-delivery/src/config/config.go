package config

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/go-redis/redis/v8"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	DB          *gorm.DB
	RedisClient *redis.Client
	S3Client    *s3.S3
	Config      *AppConfig
)

type AppConfig struct {
	// Database
	DatabaseURL string
	
	// Redis
	RedisURL      string
	RedisPassword string
	
	// AWS S3
	AWSRegion       string
	AWSAccessKey    string
	AWSSecretKey    string
	S3Bucket        string
	S3Endpoint      string
	
	// Service
	Port            string
	MaxFileSize     int64
	AllowedTypes    []string
	CDNBaseURL      string
	
	// Security
	JWTSecret       string
	APIKey          string
}

func Initialize() error {
	Config = &AppConfig{
		DatabaseURL:     getEnv("DATABASE_URL", "postgresql://localhost:5432/content_delivery"),
		RedisURL:        getEnv("UPSTASH_REDIS_REST_URL", "localhost:6379"),
		RedisPassword:   getEnv("UPSTASH_REDIS_REST_TOKEN", ""),
		AWSRegion:       getEnv("AWS_REGION", "us-east-1"),
		AWSAccessKey:    getEnv("AWS_ACCESS_KEY_ID", ""),
		AWSSecretKey:    getEnv("AWS_SECRET_ACCESS_KEY", ""),
		S3Bucket:        getEnv("S3_BUCKET", "modex-content"),
		S3Endpoint:      getEnv("S3_ENDPOINT", ""),
		Port:            getEnv("PORT", "8084"),
		MaxFileSize:     100 * 1024 * 1024, // 100MB
		AllowedTypes:    []string{"image/jpeg", "image/png", "image/gif", "video/mp4", "video/webm", "application/pdf"},
		CDNBaseURL:      getEnv("CDN_BASE_URL", "https://cdn.modex.com"),
		JWTSecret:       getEnv("JWT_SECRET", "your-secret-key"),
		APIKey:          getEnv("API_KEY", ""),
	}

	// Initialize database
	if err := initDatabase(); err != nil {
		return fmt.Errorf("failed to initialize database: %w", err)
	}

	// Initialize Redis
	if err := initRedis(); err != nil {
		return fmt.Errorf("failed to initialize Redis: %w", err)
	}

	// Initialize S3
	if err := initS3(); err != nil {
		return fmt.Errorf("failed to initialize S3: %w", err)
	}

	return nil
}

func initDatabase() error {
	db, err := gorm.Open(postgres.Open(Config.DatabaseURL), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return err
	}

	DB = db
	return nil
}

func initRedis() error {
	RedisClient = redis.NewClient(&redis.Options{
		Addr:     Config.RedisURL,
		Password: Config.RedisPassword,
		DB:       0,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := RedisClient.Ping(ctx).Result()
	return err
}

func initS3() error {
	awsConfig := &aws.Config{
		Region: aws.String(Config.AWSRegion),
	}

	// Use custom endpoint for MinIO or other S3-compatible services
	if Config.S3Endpoint != "" {
		awsConfig.Endpoint = aws.String(Config.S3Endpoint)
		awsConfig.S3ForcePathStyle = aws.Bool(true)
	}

	// Use credentials if provided
	if Config.AWSAccessKey != "" && Config.AWSSecretKey != "" {
		awsConfig.Credentials = credentials.NewStaticCredentials(
			Config.AWSAccessKey,
			Config.AWSSecretKey,
			"",
		)
	}

	sess, err := session.NewSession(awsConfig)
	if err != nil {
		return err
	}

	S3Client = s3.New(sess)
	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
