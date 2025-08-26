-- Initialize Modex database with proper schemas and extensions

-- Create database if not exists (handled by Docker)
-- \c modex;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create schemas for each service
CREATE SCHEMA IF NOT EXISTS courses;
CREATE SCHEMA IF NOT EXISTS enrollment; 
CREATE SCHEMA IF NOT EXISTS assessment;
CREATE SCHEMA IF NOT EXISTS payment;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS users;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA courses TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA enrollment TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA assessment TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA payment TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA analytics TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA users TO postgres;

GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA courses TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA enrollment TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA assessment TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA payment TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA analytics TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA users TO postgres;

-- Create indexes for better performance
-- These will be created by individual services, but we can prepare some common ones

-- Logging and monitoring
CREATE TABLE IF NOT EXISTS public.service_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    service_name VARCHAR(50) NOT NULL,
    log_level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on service logs for monitoring
CREATE INDEX IF NOT EXISTS idx_service_logs_service_time 
ON public.service_logs(service_name, created_at DESC);

-- Service health monitoring
CREATE TABLE IF NOT EXISTS public.service_health (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    service_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_time INTEGER, -- in milliseconds
    error_message TEXT,
    metadata JSONB
);

-- Create unique constraint on service health
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_health_unique_service 
ON public.service_health(service_name);

-- Insert initial service health records
INSERT INTO public.service_health (service_name, status) VALUES
('api-gateway', 'unknown'),
('course-management', 'unknown'),
('enrollment', 'unknown'),
('assessment', 'unknown'),
('payment', 'unknown'),
('analytics', 'unknown')
ON CONFLICT (service_name) DO NOTHING;

COMMIT;
