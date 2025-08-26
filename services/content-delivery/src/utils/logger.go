package utils

import (
	"encoding/json"
	"log"
	"os"
	"time"
)

type LogLevel string

const (
	LevelDebug LogLevel = "DEBUG"
	LevelInfo  LogLevel = "INFO"
	LevelWarn  LogLevel = "WARN"
	LevelError LogLevel = "ERROR"
	LevelFatal LogLevel = "FATAL"
)

type Logger struct {
	logger *log.Logger
}

var (
	// Global logger instance
	globalLogger *Logger
)

// LogEntry represents a structured log entry
type LogEntry struct {
	Timestamp time.Time              `json:"timestamp"`
	Level     LogLevel               `json:"level"`
	Message   string                 `json:"message"`
	Service   string                 `json:"service"`
	RequestID string                 `json:"requestId,omitempty"`
	UserID    string                 `json:"userId,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// InitializeLogger initializes the global logger
func InitializeLogger() {
	globalLogger = &Logger{
		logger: log.New(os.Stdout, "", 0),
	}
}

// Debug logs debug messages
func Debug(message string, metadata map[string]interface{}) {
	writeLog(LevelDebug, message, metadata)
}

// Info logs informational messages
func Info(message string, metadata map[string]interface{}) {
	writeLog(LevelInfo, message, metadata)
}

// Warn logs warning messages
func Warn(message string, metadata map[string]interface{}) {
	writeLog(LevelWarn, message, metadata)
}

// Error logs error messages
func Error(message string, metadata map[string]interface{}) {
	writeLog(LevelError, message, metadata)
}

// Fatal logs fatal messages and exits
func Fatal(message string, metadata map[string]interface{}) {
	writeLog(LevelFatal, message, metadata)
	os.Exit(1)
}

// writeLog writes a structured log entry
func writeLog(level LogLevel, message string, metadata map[string]interface{}) {
	if globalLogger == nil {
		InitializeLogger()
	}

	entry := LogEntry{
		Timestamp: time.Now().UTC(),
		Level:     level,
		Message:   message,
		Service:   "content-delivery",
		Metadata:  metadata,
	}

	// Convert to JSON
	jsonData, err := json.Marshal(entry)
	if err != nil {
		// Fallback to simple logging
		globalLogger.logger.Printf("[%s] %s - %s - %v", level, time.Now().UTC().Format(time.RFC3339), message, metadata)
		return
	}

	globalLogger.logger.Println(string(jsonData))
}

// WithRequestID creates a new logger with request ID context
func WithRequestID(requestID string) *ContextLogger {
	return &ContextLogger{
		requestID: requestID,
	}
}

// ContextLogger provides contextual logging

type ContextLogger struct {
	requestID string
	userID    string
}

// SetUserID sets the user ID for contextual logging
func (c *ContextLogger) SetUserID(userID string) *ContextLogger {
	c.userID = userID
	return c
}

// Debug logs debug messages with context
func (c *ContextLogger) Debug(message string, metadata map[string]interface{}) {
	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	metadata["requestId"] = c.requestID
	metadata["userId"] = c.userID
		writeLog(LevelDebug, message, metadata)
}

// Info logs info messages with context
func (c *ContextLogger) Info(message string, metadata map[string]interface{}) {
	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	metadata["requestId"] = c.requestID
	metadata["userId"] = c.userID
	writeLog(LevelInfo, message, metadata)
}

// Warn logs warning messages with context
func (c *ContextLogger) Warn(message string, metadata map[string]interface{}) {
	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	metadata["requestId"] = c.requestID
	metadata["userId"] = c.userID
	writeLog(LevelWarn, message, metadata)
}

// Error logs error messages with context
func (c *ContextLogger) Error(message string, metadata map[string]interface{}) {
	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	metadata["requestId"] = c.requestID
	metadata["userId"] = c.userID
	writeLog(LevelError, message, metadata)
}

// Fatal logs fatal messages with context
func (c *ContextLogger) Fatal(message string, metadata map[string]interface{}) {
	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	metadata["requestId"] = c.requestID
	metadata["userId"] = c.userID
	writeLog(LevelFatal, message, metadata)
}

// PerformanceLogger for performance metrics
type PerformanceLogger struct {
	startTime time.Time
	operation string
}

// NewPerformanceLogger creates a new performance logger
func NewPerformanceLogger(operation string) *PerformanceLogger {
	return &PerformanceLogger{
		startTime: time.Now(),
		operation: operation,
	}
}

// Log logs the performance metrics
func (p *PerformanceLogger) Log(metadata map[string]interface{}) {
	duration := time.Since(p.startTime)
	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	metadata["operation"] = p.operation
	metadata["duration_ms"] = duration.Milliseconds()
	writeLog(LevelInfo, "Performance metric", metadata)
}
