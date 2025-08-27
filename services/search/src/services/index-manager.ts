import { ElasticsearchClient } from './elasticsearch-client'
import { SearchType, IndexTemplate, IndexSettings, IndexMapping } from '../types/search'
import { logger } from '../utils/logger'

export class IndexManager {
  private esClient: ElasticsearchClient
  private environment: string

  constructor(esClient: ElasticsearchClient) {
    this.esClient = esClient
    this.environment = process.env.NODE_ENV || 'development'
  }

  async initializeIndices(): Promise<void> {
    try {
      logger.info('Initializing search indices')

      for (const type of Object.values(SearchType)) {
        await this.createIndexForType(type)
      }

      logger.info('Search indices initialized successfully')

    } catch (error) {
      logger.error('Failed to initialize search indices', { error: error.message })
      throw error
    }
  }

  async createIndexForType(type: SearchType): Promise<void> {
    try {
      const indexName = this.getIndexName(type)
      const settings = this.getIndexSettings(type)
      const mappings = this.getIndexMapping(type)

      await this.esClient.createIndex(indexName, settings, mappings)
      
      logger.info('Index created for type', { type, indexName })

    } catch (error) {
      logger.error('Failed to create index for type', { 
        type, 
        error: error.message 
      })
      throw error
    }
  }

  async updateIndexMapping(type: SearchType, mappings: IndexMapping): Promise<void> {
    try {
      const indexName = this.getIndexName(type)
      await this.esClient.updateIndexMapping(indexName, { properties: mappings })
      
      logger.info('Index mapping updated for type', { type, indexName })

    } catch (error) {
      logger.error('Failed to update index mapping for type', { 
        type, 
        error: error.message 
      })
      throw error
    }
  }

  async recreateIndex(type: SearchType): Promise<void> {
    try {
      const indexName = this.getIndexName(type)
      const backupIndexName = `${indexName}_backup_${Date.now()}`

      // Create backup
      logger.info('Creating backup index', { type, backupIndexName })
      const reindexTask = await this.esClient.reindex(indexName, backupIndexName)

      // Wait for reindex to complete
      await this.waitForTask(reindexTask.task)

      // Delete original index
      await this.esClient.deleteIndex(indexName)

      // Recreate with new settings
      await this.createIndexForType(type)

      logger.info('Index recreated successfully', { type, indexName })

    } catch (error) {
      logger.error('Failed to recreate index for type', { 
        type, 
        error: error.message 
      })
      throw error
    }
  }

  private getIndexName(type: SearchType): string {
    return `modex_${this.environment}_${type}`
  }

  private getIndexSettings(type: SearchType): IndexSettings {
    const baseSettings: IndexSettings = {
      numberOfShards: this.environment === 'production' ? 3 : 1,
      numberOfReplicas: this.environment === 'production' ? 2 : 0,
      analysis: {
        analyzer: {
          search_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: [
              'lowercase',
              'asciifolding',
              'search_synonym',
              'search_stop',
              'search_stemmer'
            ]
          },
          autocomplete_analyzer: {
            type: 'custom',
            tokenizer: 'autocomplete_tokenizer',
            filter: [
              'lowercase',
              'asciifolding'
            ]
          },
          content_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: [
              'lowercase',
              'asciifolding',
              'content_stop',
              'content_stemmer'
            ]
          }
        },
        tokenizer: {
          autocomplete_tokenizer: {
            type: 'edge_ngram',
            min_gram: 2,
            max_gram: 10,
            token_chars: ['letter', 'digit']
          }
        },
        filter: {
          search_synonym: {
            type: 'synonym',
            synonyms: [
              'js,javascript',
              'ts,typescript',
              'py,python',
              'ml,machine learning',
              'ai,artificial intelligence',
              'db,database',
              'api,application programming interface'
            ]
          },
          search_stop: {
            type: 'stop',
            stopwords: ['_english_', 'course', 'lesson', 'tutorial', 'guide']
          },
          search_stemmer: {
            type: 'stemmer',
            language: 'english'
          },
          content_stop: {
            type: 'stop',
            stopwords: '_english_'
          },
          content_stemmer: {
            type: 'stemmer',
            language: 'english'
          }
        }
      }
    }

    return baseSettings
  }

  private getIndexMapping(type: SearchType): IndexMapping {
    const commonFields: IndexMapping = {
      id: { type: 'keyword' },
      searchType: { type: 'keyword' },
      title: {
        type: 'text',
        analyzer: 'search_analyzer',
        fields: {
          keyword: { type: 'keyword' },
          autocomplete: {
            type: 'text',
            analyzer: 'autocomplete_analyzer',
            search_analyzer: 'search_analyzer'
          }
        }
      },
      description: {
        type: 'text',
        analyzer: 'content_analyzer'
      },
      searchableContent: {
        type: 'text',
        analyzer: 'content_analyzer'
      },
      titleBoost: {
        type: 'text',
        analyzer: 'search_analyzer'
      },
      contentBoost: {
        type: 'text',
        analyzer: 'content_analyzer'
      },
      tags: {
        type: 'text',
        analyzer: 'search_analyzer',
        fields: {
          keyword: { type: 'keyword' }
        }
      },
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
      indexedAt: { type: 'date' }
    }

    switch (type) {
      case SearchType.COURSE:
        return {
          ...commonFields,
          shortDescription: {
            type: 'text',
            analyzer: 'content_analyzer'
          },
          instructor: {
            properties: {
              id: { type: 'keyword' },
              name: {
                type: 'text',
                analyzer: 'search_analyzer',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              email: { type: 'keyword' },
              rating: { type: 'float' }
            }
          },
          category: {
            type: 'text',
            analyzer: 'search_analyzer',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          subcategory: {
            type: 'text',
            analyzer: 'search_analyzer',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          difficulty: { type: 'keyword' },
          duration: { type: 'integer' },
          price: { type: 'float' },
          currency: { type: 'keyword' },
          rating: { type: 'float' },
          reviewCount: { type: 'integer' },
          enrollmentCount: { type: 'integer' },
          language: { type: 'keyword' },
          skills: {
            type: 'text',
            analyzer: 'search_analyzer',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          prerequisites: {
            type: 'text',
            analyzer: 'content_analyzer'
          },
          learningObjectives: {
            type: 'text',
            analyzer: 'content_analyzer'
          },
          status: { type: 'keyword' },
          publishedAt: { type: 'date' }
        }

      case SearchType.LESSON:
        return {
          ...commonFields,
          courseId: { type: 'keyword' },
          content: {
            type: 'text',
            analyzer: 'content_analyzer'
          },
          type: { type: 'keyword' },
          duration: { type: 'integer' },
          order: { type: 'integer' },
          isPreview: { type: 'boolean' }
        }

      case SearchType.INSTRUCTOR:
        return {
          ...commonFields,
          name: {
            type: 'text',
            analyzer: 'search_analyzer',
            fields: {
              keyword: { type: 'keyword' },
              autocomplete: {
                type: 'text',
                analyzer: 'autocomplete_analyzer',
                search_analyzer: 'search_analyzer'
              }
            }
          },
          email: { type: 'keyword' },
          bio: {
            type: 'text',
            analyzer: 'content_analyzer'
          },
          expertise: {
            type: 'text',
            analyzer: 'search_analyzer',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          experience: {
            type: 'text',
            analyzer: 'content_analyzer'
          },
          qualifications: {
            type: 'text',
            analyzer: 'content_analyzer'
          },
          rating: { type: 'float' },
          reviewCount: { type: 'integer' },
          courseCount: { type: 'integer' },
          studentCount: { type: 'integer' },
          languages: { type: 'keyword' },
          socialLinks: {
            type: 'object',
            enabled: false
          }
        }

      case SearchType.USER:
        return {
          ...commonFields,
          name: {
            type: 'text',
            analyzer: 'search_analyzer',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          email: { type: 'keyword' },
          bio: {
            type: 'text',
            analyzer: 'content_analyzer'
          },
          role: { type: 'keyword' },
          skills: {
            type: 'text',
            analyzer: 'search_analyzer',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          interests: {
            type: 'text',
            analyzer: 'search_analyzer',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          location: { type: 'keyword' },
          language: { type: 'keyword' },
          joinedAt: { type: 'date' },
          lastActive: { type: 'date' },
          isActive: { type: 'boolean' }
        }

      case SearchType.CONTENT:
        return {
          ...commonFields,
          content: {
            type: 'text',
            analyzer: 'content_analyzer'
          },
          type: { type: 'keyword' },
          author: { type: 'keyword' },
          category: {
            type: 'text',
            analyzer: 'search_analyzer',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          status: { type: 'keyword' }
        }

      case SearchType.FORUM_POST:
        return {
          ...commonFields,
          content: {
            type: 'text',
            analyzer: 'content_analyzer'
          },
          author: {
            properties: {
              id: { type: 'keyword' },
              name: {
                type: 'text',
                analyzer: 'search_analyzer',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              email: { type: 'keyword' },
              avatar: { type: 'keyword' }
            }
          },
          category: {
            type: 'text',
            analyzer: 'search_analyzer',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          replies: { type: 'integer' },
          views: { type: 'integer' },
          isAnswered: { type: 'boolean' },
          isPinned: { type: 'boolean' }
        }

      case SearchType.ANNOUNCEMENT:
        return {
          ...commonFields,
          content: {
            type: 'text',
            analyzer: 'content_analyzer'
          },
          author: {
            properties: {
              id: { type: 'keyword' },
              name: {
                type: 'text',
                analyzer: 'search_analyzer',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              email: { type: 'keyword' },
              avatar: { type: 'keyword' }
            }
          },
          type: { type: 'keyword' },
          priority: { type: 'keyword' },
          targetAudience: { type: 'keyword' },
          isActive: { type: 'boolean' },
          publishedAt: { type: 'date' },
          expiresAt: { type: 'date' }
        }

      default:
        return commonFields
    }
  }

  private async waitForTask(taskId: string, maxWaitTime: number = 300000): Promise<void> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const taskResponse = await this.esClient.getTask(taskId)
        
        if (taskResponse.completed) {
          logger.info('Task completed successfully', { taskId })
          return
        }

        // Wait 5 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 5000))
        
      } catch (error) {
        logger.error('Error checking task status', { 
          taskId, 
          error: error.message 
        })
        break
      }
    }

    throw new Error(`Task ${taskId} did not complete within ${maxWaitTime}ms`)
  }

  async getIndexHealth(): Promise<Record<string, any>> {
    try {
      const health: Record<string, any> = {}

      for (const type of Object.values(SearchType)) {
        const indexName = this.getIndexName(type)
        
        try {
          const stats = await this.esClient.getIndexStats(indexName)
          health[type] = {
            exists: true,
            documentCount: stats.indices[indexName]?.total?.docs?.count || 0,
            storeSize: stats.indices[indexName]?.total?.store?.size_in_bytes || 0,
            status: 'healthy'
          }
        } catch (error) {
          health[type] = {
            exists: false,
            status: 'error',
            error: error.message
          }
        }
      }

      return health

    } catch (error) {
      logger.error('Failed to get index health', { error: error.message })
      throw error
    }
  }

  async refreshAllIndices(): Promise<void> {
    try {
      for (const type of Object.values(SearchType)) {
        const indexName = this.getIndexName(type)
        await this.esClient.refreshIndex(indexName)
      }
      
      logger.info('All indices refreshed successfully')

    } catch (error) {
      logger.error('Failed to refresh indices', { error: error.message })
      throw error
    }
  }
}
