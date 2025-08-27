import { Pool } from 'pg'
import Redis from 'ioredis'
import { 
  SearchAnalytics, 
  PopularQuery, 
  SearchType,
  CourseDocument,
  LessonDocument,
  InstructorDocument,
  UserDocument,
  ContentDocument,
  ForumPostDocument,
  AnnouncementDocument
} from '../types/search'
import { logger } from '../utils/logger'

export class SearchRepository {
  private db: Pool
  private redis: Redis

  constructor(db: Pool, redis: Redis) {
    this.db = db
    this.redis = redis
  }

  async initializeSchema(): Promise<void> {
    try {
      await this.db.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        -- Search analytics table
        CREATE TABLE IF NOT EXISTS search_analytics (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          query TEXT NOT NULL,
          search_types TEXT[],
          filters JSONB DEFAULT '{}',
          result_count INTEGER NOT NULL DEFAULT 0,
          clicked_results TEXT[],
          user_id VARCHAR(255),
          session_id VARCHAR(255),
          ip_address INET NOT NULL,
          user_agent TEXT,
          response_time INTEGER NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Popular queries materialized view
        CREATE MATERIALIZED VIEW IF NOT EXISTS popular_queries AS
        SELECT 
          LOWER(TRIM(query)) AS query,
          COUNT(*) AS search_count,
          MAX(timestamp) AS last_searched,
          AVG(result_count) AS avg_results,
          COUNT(DISTINCT user_id) AS unique_users
        FROM search_analytics 
        WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '30 days'
          AND LENGTH(TRIM(query)) > 2
        GROUP BY LOWER(TRIM(query))
        HAVING COUNT(*) > 1
        ORDER BY search_count DESC, last_searched DESC;

        -- Search suggestions table
        CREATE TABLE IF NOT EXISTS search_suggestions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          query TEXT NOT NULL UNIQUE,
          suggestion TEXT NOT NULL,
          score FLOAT DEFAULT 1.0,
          search_type VARCHAR(50),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Failed searches for analysis
        CREATE TABLE IF NOT EXISTS failed_searches (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          query TEXT NOT NULL,
          search_types TEXT[],
          filters JSONB DEFAULT '{}',
          user_id VARCHAR(255),
          session_id VARCHAR(255),
          ip_address INET NOT NULL,
          error_message TEXT,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics(query);
        CREATE INDEX IF NOT EXISTS idx_search_analytics_timestamp ON search_analytics(timestamp);
        CREATE INDEX IF NOT EXISTS idx_search_analytics_user_id ON search_analytics(user_id);
        CREATE INDEX IF NOT EXISTS idx_search_analytics_session_id ON search_analytics(session_id);
        CREATE INDEX IF NOT EXISTS idx_search_analytics_ip_address ON search_analytics(ip_address);
        
        CREATE INDEX IF NOT EXISTS idx_search_suggestions_query ON search_suggestions(query);
        CREATE INDEX IF NOT EXISTS idx_search_suggestions_score ON search_suggestions(score DESC);
        
        CREATE INDEX IF NOT EXISTS idx_failed_searches_query ON failed_searches(query);
        CREATE INDEX IF NOT EXISTS idx_failed_searches_timestamp ON failed_searches(timestamp);
      `)

      logger.info('Search repository schema initialized')

    } catch (error) {
      logger.error('Failed to initialize search schema', { error: error.message })
      throw error
    }
  }

  async logSearchAnalytics(analytics: SearchAnalytics): Promise<void> {
    try {
      const query = `
        INSERT INTO search_analytics (
          id, query, search_types, filters, result_count, clicked_results,
          user_id, session_id, ip_address, user_agent, response_time, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `

      await this.db.query(query, [
        analytics.id,
        analytics.query,
        analytics.type,
        JSON.stringify(analytics.filters),
        analytics.resultCount,
        analytics.clickedResults || [],
        analytics.userId,
        analytics.sessionId,
        analytics.ipAddress,
        analytics.userAgent,
        analytics.responseTime,
        analytics.timestamp
      ])

      // Cache recent searches for quick access
      await this.cacheRecentSearch(analytics)

    } catch (error) {
      logger.error('Failed to log search analytics', {
        analyticsId: analytics.id,
        error: error.message
      })
      throw error
    }
  }

  async getPopularQueries(limit: number = 10): Promise<PopularQuery[]> {
    try {
      // Refresh materialized view if needed
      await this.refreshPopularQueries()

      const query = `
        SELECT query, search_count as count, last_searched
        FROM popular_queries
        ORDER BY search_count DESC, last_searched DESC
        LIMIT $1
      `

      const result = await this.db.query(query, [limit])
      
      return result.rows.map(row => ({
        query: row.query,
        count: parseInt(row.count),
        lastSearched: row.last_searched
      }))

    } catch (error) {
      logger.error('Failed to get popular queries', { error: error.message })
      return []
    }
  }

  async getSearchSuggestions(query: string, limit: number = 5): Promise<string[]> {
    try {
      const cacheKey = `search_suggestions:${query.toLowerCase()}`
      const cached = await this.redis.get(cacheKey)
      
      if (cached) {
        return JSON.parse(cached)
      }

      const dbQuery = `
        SELECT suggestion
        FROM search_suggestions
        WHERE query ILIKE $1
        ORDER BY score DESC
        LIMIT $2
      `

      const result = await this.db.query(dbQuery, [`%${query}%`, limit])
      const suggestions = result.rows.map(row => row.suggestion)

      // Cache for 1 hour
      await this.redis.setex(cacheKey, 3600, JSON.stringify(suggestions))

      return suggestions

    } catch (error) {
      logger.error('Failed to get search suggestions', {
        query,
        error: error.message
      })
      return []
    }
  }

  async logFailedSearch(
    query: string,
    searchTypes: SearchType[],
    filters: any,
    userId?: string,
    sessionId?: string,
    ipAddress?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      const insertQuery = `
        INSERT INTO failed_searches (
          query, search_types, filters, user_id, session_id, ip_address, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `

      await this.db.query(insertQuery, [
        query,
        searchTypes,
        JSON.stringify(filters),
        userId,
        sessionId,
        ipAddress,
        errorMessage
      ])

    } catch (error) {
      logger.error('Failed to log failed search', {
        query,
        error: error.message
      })
    }
  }

  async getDocumentsByType(type: SearchType): Promise<any[]> {
    try {
      switch (type) {
        case SearchType.COURSE:
          return await this.getCourseDocuments()
        case SearchType.LESSON:
          return await this.getLessonDocuments()
        case SearchType.INSTRUCTOR:
          return await this.getInstructorDocuments()
        case SearchType.USER:
          return await this.getUserDocuments()
        case SearchType.CONTENT:
          return await this.getContentDocuments()
        case SearchType.FORUM_POST:
          return await this.getForumPostDocuments()
        case SearchType.ANNOUNCEMENT:
          return await this.getAnnouncementDocuments()
        default:
          return []
      }
    } catch (error) {
      logger.error('Failed to get documents by type', {
        type,
        error: error.message
      })
      throw error
    }
  }

  private async getCourseDocuments(): Promise<CourseDocument[]> {
    try {
      // This would typically query the course service database
      // For now, we'll return mock data or query from a shared database
      const query = `
        SELECT 
          c.id,
          c.title,
          c.description,
          c.short_description,
          c.content,
          c.category,
          c.subcategory,
          c.difficulty,
          c.duration,
          c.price,
          c.currency,
          c.rating,
          c.review_count,
          c.enrollment_count,
          c.language,
          c.tags,
          c.skills,
          c.prerequisites,
          c.learning_objectives,
          c.status,
          c.created_at,
          c.updated_at,
          c.published_at,
          i.id as instructor_id,
          i.name as instructor_name,
          i.email as instructor_email,
          i.rating as instructor_rating
        FROM courses c
        LEFT JOIN instructors i ON c.instructor_id = i.id
        WHERE c.status = 'published'
      `

      const result = await this.db.query(query)
      
      return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        shortDescription: row.short_description,
        content: row.content,
        instructor: {
          id: row.instructor_id,
          name: row.instructor_name,
          email: row.instructor_email,
          rating: row.instructor_rating
        },
        category: row.category,
        subcategory: row.subcategory,
        difficulty: row.difficulty,
        duration: row.duration,
        price: row.price,
        currency: row.currency,
        rating: row.rating,
        reviewCount: row.review_count,
        enrollmentCount: row.enrollment_count,
        language: row.language,
        tags: row.tags || [],
        skills: row.skills || [],
        prerequisites: row.prerequisites || [],
        learningObjectives: row.learning_objectives || [],
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        publishedAt: row.published_at
      }))

    } catch (error) {
      logger.error('Failed to get course documents', { error: error.message })
      return []
    }
  }

  private async getLessonDocuments(): Promise<LessonDocument[]> {
    try {
      const query = `
        SELECT 
          l.id,
          l.course_id,
          l.title,
          l.description,
          l.content,
          l.type,
          l.duration,
          l.order_index,
          l.is_preview,
          l.tags,
          l.created_at,
          l.updated_at
        FROM lessons l
        INNER JOIN courses c ON l.course_id = c.id
        WHERE c.status = 'published'
      `

      const result = await this.db.query(query)
      
      return result.rows.map(row => ({
        id: row.id,
        courseId: row.course_id,
        title: row.title,
        description: row.description,
        content: row.content,
        type: row.type,
        duration: row.duration,
        order: row.order_index,
        isPreview: row.is_preview,
        tags: row.tags || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))

    } catch (error) {
      logger.error('Failed to get lesson documents', { error: error.message })
      return []
    }
  }

  private async getInstructorDocuments(): Promise<InstructorDocument[]> {
    try {
      const query = `
        SELECT 
          i.id,
          i.name,
          i.email,
          i.bio,
          i.expertise,
          i.experience,
          i.qualifications,
          i.rating,
          i.review_count,
          i.languages,
          i.social_links,
          i.created_at,
          COUNT(c.id) as course_count,
          COALESCE(SUM(c.enrollment_count), 0) as student_count
        FROM instructors i
        LEFT JOIN courses c ON i.id = c.instructor_id AND c.status = 'published'
        WHERE i.is_active = true
        GROUP BY i.id
      `

      const result = await this.db.query(query)
      
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        bio: row.bio,
        expertise: row.expertise || [],
        experience: row.experience,
        qualifications: row.qualifications || [],
        rating: row.rating,
        reviewCount: row.review_count,
        courseCount: parseInt(row.course_count),
        studentCount: parseInt(row.student_count),
        languages: row.languages || [],
        socialLinks: row.social_links || {},
        createdAt: row.created_at
      }))

    } catch (error) {
      logger.error('Failed to get instructor documents', { error: error.message })
      return []
    }
  }

  private async getUserDocuments(): Promise<UserDocument[]> {
    try {
      const query = `
        SELECT 
          u.id,
          u.name,
          u.email,
          u.bio,
          u.role,
          u.skills,
          u.interests,
          u.location,
          u.language,
          u.created_at,
          u.last_active,
          u.is_active
        FROM users u
        WHERE u.is_active = true
          AND u.role IN ('student', 'instructor', 'admin')
      `

      const result = await this.db.query(query)
      
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        bio: row.bio,
        role: row.role,
        skills: row.skills || [],
        interests: row.interests || [],
        location: row.location,
        language: row.language,
        joinedAt: row.created_at,
        lastActive: row.last_active,
        isActive: row.is_active
      }))

    } catch (error) {
      logger.error('Failed to get user documents', { error: error.message })
      return []
    }
  }

  private async getContentDocuments(): Promise<ContentDocument[]> {
    try {
      const query = `
        SELECT 
          c.id,
          c.title,
          c.content,
          c.type,
          c.author_id as author,
          c.tags,
          c.category,
          c.status,
          c.created_at,
          c.updated_at
        FROM content c
        WHERE c.status = 'published'
      `

      const result = await this.db.query(query)
      
      return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        type: row.type,
        author: row.author,
        tags: row.tags || [],
        category: row.category,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))

    } catch (error) {
      logger.error('Failed to get content documents', { error: error.message })
      return []
    }
  }

  private async getForumPostDocuments(): Promise<ForumPostDocument[]> {
    try {
      const query = `
        SELECT 
          fp.id,
          fp.title,
          fp.content,
          fp.category,
          fp.tags,
          fp.replies,
          fp.views,
          fp.is_answered,
          fp.is_pinned,
          fp.created_at,
          fp.updated_at,
          u.id as author_id,
          u.name as author_name,
          u.email as author_email,
          u.avatar as author_avatar
        FROM forum_posts fp
        LEFT JOIN users u ON fp.author_id = u.id
        WHERE fp.status = 'published'
      `

      const result = await this.db.query(query)
      
      return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        author: {
          id: row.author_id,
          name: row.author_name,
          email: row.author_email,
          avatar: row.author_avatar
        },
        category: row.category,
        tags: row.tags || [],
        replies: row.replies,
        views: row.views,
        isAnswered: row.is_answered,
        isPinned: row.is_pinned,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))

    } catch (error) {
      logger.error('Failed to get forum post documents', { error: error.message })
      return []
    }
  }

  private async getAnnouncementDocuments(): Promise<AnnouncementDocument[]> {
    try {
      const query = `
        SELECT 
          a.id,
          a.title,
          a.content,
          a.type,
          a.priority,
          a.target_audience,
          a.is_active,
          a.published_at,
          a.expires_at,
          u.id as author_id,
          u.name as author_name,
          u.email as author_email,
          u.avatar as author_avatar
        FROM announcements a
        LEFT JOIN users u ON a.author_id = u.id
        WHERE a.is_active = true
          AND (a.expires_at IS NULL OR a.expires_at > CURRENT_TIMESTAMP)
      `

      const result = await this.db.query(query)
      
      return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        author: {
          id: row.author_id,
          name: row.author_name,
          email: row.author_email,
          avatar: row.author_avatar
        },
        type: row.type,
        priority: row.priority,
        targetAudience: row.target_audience || [],
        isActive: row.is_active,
        publishedAt: row.published_at,
        expiresAt: row.expires_at
      }))

    } catch (error) {
      logger.error('Failed to get announcement documents', { error: error.message })
      return []
    }
  }

  private async cacheRecentSearch(analytics: SearchAnalytics): Promise<void> {
    try {
      const key = `recent_searches:${analytics.userId || 'anonymous'}`
      const searchData = {
        query: analytics.query,
        timestamp: analytics.timestamp.toISOString(),
        resultCount: analytics.resultCount
      }

      await this.redis.lpush(key, JSON.stringify(searchData))
      await this.redis.ltrim(key, 0, 49) // Keep last 50 searches
      await this.redis.expire(key, 86400 * 7) // 7 days

    } catch (error) {
      logger.warn('Failed to cache recent search', { error: error.message })
    }
  }

  private async refreshPopularQueries(): Promise<void> {
    try {
      // Check if materialized view needs refresh (once per hour)
      const lastRefresh = await this.redis.get('popular_queries_last_refresh')
      const now = Date.now()
      
      if (!lastRefresh || now - parseInt(lastRefresh) > 3600000) { // 1 hour
        await this.db.query('REFRESH MATERIALIZED VIEW popular_queries')
        await this.redis.set('popular_queries_last_refresh', now.toString())
        logger.debug('Popular queries materialized view refreshed')
      }

    } catch (error) {
      logger.warn('Failed to refresh popular queries', { error: error.message })
    }
  }

  async getSearchAnalytics(
    startDate: Date,
    endDate: Date,
    limit: number = 1000
  ): Promise<SearchAnalytics[]> {
    try {
      const query = `
        SELECT *
        FROM search_analytics
        WHERE timestamp >= $1 AND timestamp <= $2
        ORDER BY timestamp DESC
        LIMIT $3
      `

      const result = await this.db.query(query, [startDate, endDate, limit])
      
      return result.rows.map(row => ({
        id: row.id,
        query: row.query,
        type: row.search_types,
        filters: row.filters,
        resultCount: row.result_count,
        clickedResults: row.clicked_results,
        userId: row.user_id,
        sessionId: row.session_id,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        timestamp: row.timestamp,
        responseTime: row.response_time
      }))

    } catch (error) {
      logger.error('Failed to get search analytics', { error: error.message })
      return []
    }
  }

  async getSearchTrends(days: number = 30): Promise<any[]> {
    try {
      const query = `
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as search_count,
          COUNT(DISTINCT query) as unique_queries,
          COUNT(DISTINCT user_id) as unique_users,
          AVG(result_count) as avg_results,
          AVG(response_time) as avg_response_time
        FROM search_analytics
        WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `

      const result = await this.db.query(query)
      
      return result.rows.map(row => ({
        date: row.date,
        searchCount: parseInt(row.search_count),
        uniqueQueries: parseInt(row.unique_queries),
        uniqueUsers: parseInt(row.unique_users),
        avgResults: parseFloat(row.avg_results),
        avgResponseTime: parseFloat(row.avg_response_time)
      }))

    } catch (error) {
      logger.error('Failed to get search trends', { error: error.message })
      return []
    }
  }
}
