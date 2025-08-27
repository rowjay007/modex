import { 
  SearchRequest,
  SearchResponse,
  SearchResult,
  SearchType,
  AutocompleteRequest,
  AutocompleteResponse,
  SearchAnalytics,
  PopularQuery,
  SearchConfig,
  BulkIndexRequest,
  BulkIndexResponse
} from '../types/search'
import { ElasticsearchClient } from './elasticsearch-client'
import { SearchRepository } from '../repositories/search-repository'
import { IndexManager } from './index-manager'
import { QueryBuilder } from './query-builder'
import { logger } from '../utils/logger'
import Redis from 'ioredis'
import { v4 as uuidv4 } from 'uuid'
import * as natural from 'natural'
import { removeStopwords } from 'stopword'

export class SearchService {
  private esClient: ElasticsearchClient
  private searchRepository: SearchRepository
  private indexManager: IndexManager
  private queryBuilder: QueryBuilder
  private redis: Redis
  private config: SearchConfig

  constructor(
    esClient: ElasticsearchClient,
    searchRepository: SearchRepository,
    indexManager: IndexManager,
    queryBuilder: QueryBuilder,
    redis: Redis
  ) {
    this.esClient = esClient
    this.searchRepository = searchRepository
    this.indexManager = indexManager
    this.queryBuilder = queryBuilder
    this.redis = redis
    
    this.config = {
      defaultSize: 20,
      maxSize: 100,
      highlightFragmentSize: 150,
      highlightNumberOfFragments: 3,
      suggestionSize: 10,
      facetSize: 50,
      timeout: 30000
    }
  }

  async search(request: SearchRequest, userId?: string, sessionId?: string, ipAddress?: string): Promise<SearchResponse> {
    const startTime = Date.now()

    try {
      // Validate and normalize request
      const normalizedRequest = this.normalizeSearchRequest(request)
      
      // Build Elasticsearch query
      const esQuery = this.queryBuilder.buildSearchQuery(normalizedRequest)
      
      // Determine target indices
      const indices = this.getTargetIndices(normalizedRequest.type)
      
      // Execute search
      const esResponse = await this.esClient.searchMultipleIndices(indices, esQuery)
      
      // Transform response
      const searchResponse = this.transformSearchResponse(esResponse, normalizedRequest)
      
      const responseTime = Date.now() - startTime
      searchResponse.took = responseTime

      // Log search analytics (async)
      this.logSearchAnalytics({
        query: normalizedRequest.query,
        type: normalizedRequest.type || [],
        filters: normalizedRequest.filters,
        resultCount: searchResponse.total,
        userId,
        sessionId,
        ipAddress,
        responseTime
      }).catch(error => {
        logger.warn('Failed to log search analytics', { error: error.message })
      })

      // Cache popular queries
      this.cachePopularQuery(normalizedRequest.query).catch(error => {
        logger.warn('Failed to cache popular query', { error: error.message })
      })

      logger.info('Search completed successfully', {
        query: normalizedRequest.query,
        resultCount: searchResponse.total,
        took: responseTime,
        userId
      })

      return searchResponse

    } catch (error) {
      logger.error('Search operation failed', {
        query: request.query,
        error: error.message,
        userId
      })
      throw error
    }
  }

  async autocomplete(request: AutocompleteRequest): Promise<AutocompleteResponse> {
    const startTime = Date.now()

    try {
      const query = this.queryBuilder.buildAutocompleteQuery(request)
      const indices = this.getTargetIndices(request.types)
      
      const esResponse = await this.esClient.searchMultipleIndices(indices, query)
      
      const suggestions = this.extractAutocompleteSuggestions(esResponse, request.limit || 10)
      
      return {
        suggestions,
        took: Date.now() - startTime
      }

    } catch (error) {
      logger.error('Autocomplete operation failed', {
        query: request.query,
        error: error.message
      })
      throw error
    }
  }

  async getSuggestions(query: string, limit: number = 5): Promise<string[]> {
    try {
      // Check cached suggestions first
      const cachedKey = `suggestions:${query.toLowerCase()}`
      const cached = await this.redis.get(cachedKey)
      
      if (cached) {
        return JSON.parse(cached)
      }

      // Generate suggestions using natural language processing
      const suggestions = await this.generateSuggestions(query, limit)
      
      // Cache suggestions for 1 hour
      await this.redis.setex(cachedKey, 3600, JSON.stringify(suggestions))
      
      return suggestions

    } catch (error) {
      logger.error('Failed to get suggestions', {
        query,
        error: error.message
      })
      return []
    }
  }

  async getPopularQueries(limit: number = 10): Promise<PopularQuery[]> {
    try {
      return await this.searchRepository.getPopularQueries(limit)
    } catch (error) {
      logger.error('Failed to get popular queries', { error: error.message })
      return []
    }
  }

  async indexDocument(type: SearchType, id: string, document: any): Promise<void> {
    try {
      const indexName = this.getIndexName(type)
      const processedDocument = this.preprocessDocument(document, type)
      
      await this.esClient.indexDocument(indexName, id, processedDocument)
      
      logger.debug('Document indexed successfully', {
        type,
        id,
        indexName
      })

    } catch (error) {
      logger.error('Failed to index document', {
        type,
        id,
        error: error.message
      })
      throw error
    }
  }

  async updateDocument(type: SearchType, id: string, document: any): Promise<void> {
    try {
      const indexName = this.getIndexName(type)
      const processedDocument = this.preprocessDocument(document, type)
      
      await this.esClient.updateDocument(indexName, id, processedDocument)
      
      logger.debug('Document updated successfully', {
        type,
        id,
        indexName
      })

    } catch (error) {
      logger.error('Failed to update document', {
        type,
        id,
        error: error.message
      })
      throw error
    }
  }

  async deleteDocument(type: SearchType, id: string): Promise<void> {
    try {
      const indexName = this.getIndexName(type)
      
      await this.esClient.deleteDocument(indexName, id)
      
      logger.debug('Document deleted successfully', {
        type,
        id,
        indexName
      })

    } catch (error) {
      logger.error('Failed to delete document', {
        type,
        id,
        error: error.message
      })
      throw error
    }
  }

  async bulkIndex(request: BulkIndexRequest): Promise<BulkIndexResponse> {
    try {
      const operations: any[] = []
      
      for (const item of request.documents) {
        operations.push({
          index: {
            _index: item.index,
            _id: item.id
          }
        })
        operations.push(item.document)
      }

      const esResponse = await this.esClient.bulkIndex(operations)
      
      return {
        took: esResponse.took,
        errors: esResponse.errors,
        items: esResponse.items
      }

    } catch (error) {
      logger.error('Bulk index operation failed', {
        documentCount: request.documents.length,
        error: error.message
      })
      throw error
    }
  }

  async reindexAll(): Promise<void> {
    try {
      logger.info('Starting full reindex')
      
      // Reindex each document type
      for (const type of Object.values(SearchType)) {
        await this.reindexType(type)
      }

      logger.info('Full reindex completed successfully')

    } catch (error) {
      logger.error('Full reindex failed', { error: error.message })
      throw error
    }
  }

  async reindexType(type: SearchType): Promise<void> {
    try {
      logger.info('Starting reindex for type', { type })
      
      // Get documents from primary data source
      const documents = await this.searchRepository.getDocumentsByType(type)
      
      if (documents.length === 0) {
        logger.info('No documents found for reindex', { type })
        return
      }

      // Prepare bulk index request
      const indexName = this.getIndexName(type)
      const bulkRequest: BulkIndexRequest = {
        documents: documents.map(doc => ({
          index: indexName,
          id: doc.id,
          document: this.preprocessDocument(doc, type)
        }))
      }

      // Execute bulk index
      await this.bulkIndex(bulkRequest)
      
      logger.info('Reindex completed for type', {
        type,
        documentCount: documents.length
      })

    } catch (error) {
      logger.error('Reindex failed for type', {
        type,
        error: error.message
      })
      throw error
    }
  }

  private normalizeSearchRequest(request: SearchRequest): SearchRequest {
    return {
      query: request.query.trim(),
      type: request.type || Object.values(SearchType),
      filters: request.filters || {},
      sort: request.sort || [{ field: '_score', order: 'desc' }],
      pagination: {
        page: request.pagination?.page || 1,
        size: Math.min(request.pagination?.size || this.config.defaultSize, this.config.maxSize)
      },
      highlight: request.highlight !== false,
      suggestions: request.suggestions !== false
    }
  }

  private getTargetIndices(types?: SearchType[]): string[] {
    if (!types || types.length === 0) {
      return Object.values(SearchType).map(type => this.getIndexName(type))
    }
    
    return types.map(type => this.getIndexName(type))
  }

  private getIndexName(type: SearchType): string {
    const environment = process.env.NODE_ENV || 'development'
    return `modex_${environment}_${type}`
  }

  private transformSearchResponse(esResponse: any, request: SearchRequest): SearchResponse {
    const results: SearchResult[] = esResponse.hits.hits.map((hit: any) => ({
      id: hit._id,
      type: this.getTypeFromIndex(hit._index),
      score: hit._score,
      source: hit._source,
      highlights: hit.highlight
    }))

    const facets = this.extractFacets(esResponse.aggregations)
    const total = typeof esResponse.hits.total === 'object' 
      ? esResponse.hits.total.value 
      : esResponse.hits.total

    return {
      results,
      total,
      page: request.pagination?.page || 1,
      size: request.pagination?.size || this.config.defaultSize,
      took: esResponse.took,
      facets
    }
  }

  private getTypeFromIndex(indexName: string): SearchType {
    const parts = indexName.split('_')
    const type = parts[parts.length - 1] as SearchType
    return type
  }

  private extractFacets(aggregations: any): any {
    if (!aggregations) return undefined

    const facets: any = {}
    
    for (const [key, agg] of Object.entries(aggregations)) {
      if (agg && typeof agg === 'object' && 'buckets' in agg) {
        facets[key] = (agg as any).buckets.map((bucket: any) => ({
          key: bucket.key,
          count: bucket.doc_count
        }))
      }
    }

    return Object.keys(facets).length > 0 ? facets : undefined
  }

  private extractAutocompleteSuggestions(esResponse: any, limit: number): any[] {
    const suggestions: any[] = []
    
    // Extract from search results
    if (esResponse.hits?.hits) {
      for (const hit of esResponse.hits.hits.slice(0, limit)) {
        suggestions.push({
          text: hit._source.title || hit._source.name || hit._source.content?.substring(0, 50),
          type: this.getTypeFromIndex(hit._index),
          score: hit._score,
          id: hit._id
        })
      }
    }

    // Extract from suggest results
    if (esResponse.suggest) {
      for (const [key, suggestionGroup] of Object.entries(esResponse.suggest)) {
        const group = suggestionGroup as any[]
        for (const suggestion of group) {
          for (const option of suggestion.options.slice(0, limit - suggestions.length)) {
            suggestions.push({
              text: option.text,
              type: SearchType.COURSE, // Default type
              score: option.score
            })
          }
        }
      }
    }

    return suggestions.slice(0, limit)
  }

  private async generateSuggestions(query: string, limit: number): Promise<string[]> {
    try {
      // Clean and tokenize query
      const tokens = natural.WordTokenizer.tokenize(query.toLowerCase())
      const cleanTokens = removeStopwords(tokens)
      
      // Get popular queries that match
      const popularQueries = await this.getPopularQueries(50)
      const suggestions: string[] = []

      for (const popular of popularQueries) {
        if (suggestions.length >= limit) break
        
        const popularTokens = natural.WordTokenizer.tokenize(popular.query.toLowerCase())
        const distance = natural.JaroWinklerDistance(query.toLowerCase(), popular.query.toLowerCase())
        
        if (distance > 0.7 || this.hasCommonTokens(cleanTokens, popularTokens)) {
          suggestions.push(popular.query)
        }
      }

      // Add spelling corrections
      if (suggestions.length < limit) {
        const corrections = this.getSpellingSuggestions(query)
        suggestions.push(...corrections.slice(0, limit - suggestions.length))
      }

      return suggestions

    } catch (error) {
      logger.error('Failed to generate suggestions', {
        query,
        error: error.message
      })
      return []
    }
  }

  private hasCommonTokens(tokens1: string[], tokens2: string[]): boolean {
    const set1 = new Set(tokens1)
    const set2 = new Set(tokens2)
    
    for (const token of set1) {
      if (set2.has(token)) {
        return true
      }
    }
    
    return false
  }

  private getSpellingSuggestions(query: string): string[] {
    // This is a simplified implementation
    // In production, you might use a more sophisticated spell checker
    const suggestions: string[] = []
    
    // Common misspellings in educational context
    const corrections: Record<string, string> = {
      'programing': 'programming',
      'machien': 'machine',
      'leanring': 'learning',
      'javascirpt': 'javascript',
      'algoritm': 'algorithm',
      'databse': 'database'
    }

    const words = query.toLowerCase().split(' ')
    let hasCorrection = false
    
    const correctedWords = words.map(word => {
      if (corrections[word]) {
        hasCorrection = true
        return corrections[word]
      }
      return word
    })

    if (hasCorrection) {
      suggestions.push(correctedWords.join(' '))
    }

    return suggestions
  }

  private preprocessDocument(document: any, type: SearchType): any {
    const processed = { ...document }

    // Add search-specific fields
    processed.searchType = type
    processed.indexedAt = new Date()

    // Extract searchable text content
    processed.searchableContent = this.extractSearchableContent(document, type)

    // Add boost fields for relevance scoring
    processed.titleBoost = document.title || document.name || ''
    processed.contentBoost = document.description || document.content || ''

    return processed
  }

  private extractSearchableContent(document: any, type: SearchType): string {
    const content: string[] = []

    // Add type-specific content extraction
    switch (type) {
      case SearchType.COURSE:
        content.push(
          document.title || '',
          document.description || '',
          document.shortDescription || '',
          (document.tags || []).join(' '),
          (document.skills || []).join(' '),
          (document.learningObjectives || []).join(' ')
        )
        break

      case SearchType.LESSON:
        content.push(
          document.title || '',
          document.description || '',
          document.content || '',
          (document.tags || []).join(' ')
        )
        break

      case SearchType.INSTRUCTOR:
        content.push(
          document.name || '',
          document.bio || '',
          document.experience || '',
          (document.expertise || []).join(' '),
          (document.qualifications || []).join(' ')
        )
        break

      default:
        content.push(
          document.title || document.name || '',
          document.description || document.content || document.bio || ''
        )
    }

    return content.filter(Boolean).join(' ')
  }

  private async logSearchAnalytics(analytics: Omit<SearchAnalytics, 'id' | 'timestamp'>): Promise<void> {
    try {
      const searchAnalytics: SearchAnalytics = {
        id: uuidv4(),
        ...analytics,
        timestamp: new Date()
      }

      await this.searchRepository.logSearchAnalytics(searchAnalytics)

    } catch (error) {
      logger.error('Failed to log search analytics', { error: error.message })
    }
  }

  private async cachePopularQuery(query: string): Promise<void> {
    try {
      const key = `popular_query:${query.toLowerCase()}`
      await this.redis.incr(key)
      await this.redis.expire(key, 86400 * 30) // 30 days

    } catch (error) {
      logger.error('Failed to cache popular query', { 
        query, 
        error: error.message 
      })
    }
  }
}
