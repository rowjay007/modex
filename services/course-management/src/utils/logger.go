package utils

import (
	"fmt"
	"log"
	"os"
	"runtime"
	"time"
)

// Logger provides centralized logging functionality
type Logger struct {
	*log.Logger
}

var (
	// Global logger instance
	globalLogger *Logger
)

// init initializes the global logger
func init() {
	globalLogger = NewLogger()
}

// NewLogger creates a new logger instance
func NewLogger() *Logger {
	return &Logger{
		Logger: log.New(os.Stdout, "", 0),
	}
}

// GetLogger returns the global logger instance
func GetLogger() *Logger {
	return globalLogger
}

// log formats and outputs log messages
func (l *Logger) log(level, message string, fields map[string]interface{}) {
	timestamp := time.Now().Format("2006-01-02 15:04:05")
	
	// Get caller info
	_, file, line, ok := runtime.Caller(2)
	if !ok {
		file = "unknown"
		line = 0
	}
	
	// Create log entry
	logEntry := fmt.Sprintf("[%s] %s %s:%d - %s", 
		timestamp, level, file, line, message)
	
	// Add fields if provided
	if len(fields) > 0 {
		logEntry += " |"
		for key, value := range fields {
			logEntry += fmt.Sprintf(" %s=%v", key, value)
		}
	}
	
	l.Println(logEntry)
}

// Info logs informational messages
func (l *Logger) Info(message string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log("INFO", message, f)
}

// Error logs error messages
func (l *Logger) Error(message string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log("ERROR", message, f)
}

// Warn logs warning messages
func (l *Logger) Warn(message string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log("WARN", message, f)
}

// Debug logs debug messages
func (l *Logger) Debug(message string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log("DEBUG", message, f)
}

// Fatal logs fatal messages and exits
func (l *Logger) Fatal(message string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log("FATAL", message, f)
	os.Exit(1)
}

// Convenience functions for global logger
func Info(message string, fields ...map[string]interface{}) {
	globalLogger.Info(message, fields...)
}

func Error(message string, fields ...map[string]interface{}) {
	globalLogger.Error(message, fields...)
}

func Warn(message string, fields ...map[string]interface{}) {
	globalLogger.Warn(message, fields...)
}

func Debug(message string, fields ...map[string]interface{}) {
	globalLogger.Debug(message, fields...)
}

func Fatal(message string, fields ...map[string]interface{}) {
	globalLogger.Fatal(message, fields...)
}
