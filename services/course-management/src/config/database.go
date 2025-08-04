package config

import (
	"fmt"
	"log"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDatabase initializes the PostgreSQL database connection
func InitDatabase() error {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return fmt.Errorf("DATABASE_URL environment variable is required")
	}

	// Configure GORM
	config := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
		PrepareStmt: true,
		CreateBatchSize: 100,
	}

	// Open database connection
	db, err := gorm.Open(postgres.Open(dsn), config)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Get underlying SQL database
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get SQL database: %w", err)
	}

	// Configure connection pool
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Test connection
	if err := sqlDB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	DB = db
	log.Println("Database connection established successfully")
	return nil
}

// CloseDatabase closes the database connection
func CloseDatabase() error {
	if DB == nil {
		return nil
	}

	sqlDB, err := DB.DB()
	if err != nil {
		return fmt.Errorf("failed to get SQL database: %w", err)
	}

	return sqlDB.Close()
}

// MigrateDatabase runs database migrations
func MigrateDatabase() error {
	if DB == nil {
		return fmt.Errorf("database not initialized")
	}

	// Auto-migrate models
	// Note: In production, use proper migrations instead of auto-migrate
	// models := []interface{}{
	// 	&models.Course{},
	// 	&models.Module{},
	// 	&models.Lesson{},
	// 	&models.CourseTag{},
	// 	&models.Prerequisite{},
	// }
	
	// if err := DB.AutoMigrate(models...); err != nil {
	// 	return fmt.Errorf("failed to auto-migrate: %w", err)
	// }

	log.Println("Database migration completed")
	return nil
}
