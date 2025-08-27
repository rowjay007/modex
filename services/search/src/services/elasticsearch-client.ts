import { Client } from '@elastic/elasticsearch'
import { logger } from '../utils/logger'

export class ElasticsearchClient {
  private client: Client
  private isConnected: boolean = false

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD ? {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD
      } : undefined,
      maxRetries: 5,
      requestTimeout: 60000,
      sniffOnStart: true,
      sniffInterval: 300000, // 5 minutes
      resurrectStrategy: 'ping'
    })
  }

  async connect(): Promise<void> {
    try {
      const health = await this.client.cluster.health()
      this.isConnected = true
      
      logger.info('Connected to Elasticsearch', {
        clusterName: health.cluster_name,
        status: health.status,
        numberOfNodes: health.number_of_nodes
      })
    } catch (error) {
      this.isConnected = false
      logger.error('Failed to connect to Elasticsearch', { 
        error: error.message,
        elasticsearchUrl: process.env.ELASTICSEARCH_URL 
      })
      throw error
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.close()
      this.isConnected = false
      logger.info('Disconnected from Elasticsearch')
    } catch (error) {
      logger.error('Error disconnecting from Elasticsearch', { error: error.message })
    }
  }

  getClient(): Client {
    if (!this.isConnected) {
      throw new Error('Elasticsearch client not connected')
    }
    return this.client
  }

  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.client.cluster.health()
      return health.status === 'green' || health.status === 'yellow'
    } catch (error) {
      logger.error('Elasticsearch health check failed', { error: error.message })
      return false
    }
  }

  async createIndex(indexName: string, settings: any, mappings: any): Promise<void> {
    try {
      const exists = await this.client.indices.exists({ index: indexName })
      
      if (exists) {
        logger.info('Index already exists', { indexName })
        return
      }

      await this.client.indices.create({
        index: indexName,
        body: {
          settings,
          mappings
        }
      })

      logger.info('Index created successfully', { indexName })
    } catch (error) {
      logger.error('Failed to create index', { 
        indexName, 
        error: error.message 
      })
      throw error
    }
  }

  async deleteIndex(indexName: string): Promise<void> {
    try {
      const exists = await this.client.indices.exists({ index: indexName })
      
      if (!exists) {
        logger.info('Index does not exist', { indexName })
        return
      }

      await this.client.indices.delete({ index: indexName })
      
      logger.info('Index deleted successfully', { indexName })
    } catch (error) {
      logger.error('Failed to delete index', { 
        indexName, 
        error: error.message 
      })
      throw error
    }
  }

  async updateIndexMapping(indexName: string, mappings: any): Promise<void> {
    try {
      await this.client.indices.putMapping({
        index: indexName,
        body: mappings
      })

      logger.info('Index mapping updated successfully', { indexName })
    } catch (error) {
      logger.error('Failed to update index mapping', { 
        indexName, 
        error: error.message 
      })
      throw error
    }
  }

  async indexDocument(indexName: string, id: string, document: any): Promise<void> {
    try {
      await this.client.index({
        index: indexName,
        id,
        body: document,
        refresh: 'wait_for'
      })

      logger.debug('Document indexed successfully', { indexName, id })
    } catch (error) {
      logger.error('Failed to index document', { 
        indexName, 
        id, 
        error: error.message 
      })
      throw error
    }
  }

  async updateDocument(indexName: string, id: string, document: any): Promise<void> {
    try {
      await this.client.update({
        index: indexName,
        id,
        body: {
          doc: document,
          doc_as_upsert: true
        },
        refresh: 'wait_for'
      })

      logger.debug('Document updated successfully', { indexName, id })
    } catch (error) {
      logger.error('Failed to update document', { 
        indexName, 
        id, 
        error: error.message 
      })
      throw error
    }
  }

  async deleteDocument(indexName: string, id: string): Promise<void> {
    try {
      await this.client.delete({
        index: indexName,
        id,
        refresh: 'wait_for'
      })

      logger.debug('Document deleted successfully', { indexName, id })
    } catch (error) {
      if (error.meta?.statusCode === 404) {
        logger.debug('Document not found for deletion', { indexName, id })
        return
      }
      
      logger.error('Failed to delete document', { 
        indexName, 
        id, 
        error: error.message 
      })
      throw error
    }
  }

  async bulkIndex(operations: any[]): Promise<any> {
    try {
      const response = await this.client.bulk({
        body: operations,
        refresh: 'wait_for'
      })

      if (response.errors) {
        const errorItems = response.items.filter((item: any) => 
          item.index?.error || item.update?.error || item.delete?.error
        )
        
        logger.warn('Bulk operation completed with errors', {
          totalItems: response.items.length,
          errorCount: errorItems.length,
          errors: errorItems.slice(0, 5) // Log first 5 errors
        })
      } else {
        logger.debug('Bulk operation completed successfully', {
          totalItems: response.items.length,
          took: response.took
        })
      }

      return response
    } catch (error) {
      logger.error('Failed to perform bulk operation', { 
        operationCount: operations.length / 2, // Each operation is 2 items (header + body)
        error: error.message 
      })
      throw error
    }
  }

  async search(indexName: string, query: any): Promise<any> {
    try {
      const response = await this.client.search({
        index: indexName,
        body: query,
        timeout: '30s'
      })

      logger.debug('Search completed successfully', {
        indexName,
        totalHits: response.hits.total,
        took: response.took
      })

      return response
    } catch (error) {
      logger.error('Search operation failed', { 
        indexName, 
        error: error.message 
      })
      throw error
    }
  }

  async searchMultipleIndices(indices: string[], query: any): Promise<any> {
    try {
      const response = await this.client.search({
        index: indices,
        body: query,
        timeout: '30s'
      })

      logger.debug('Multi-index search completed successfully', {
        indices,
        totalHits: response.hits.total,
        took: response.took
      })

      return response
    } catch (error) {
      logger.error('Multi-index search operation failed', { 
        indices, 
        error: error.message 
      })
      throw error
    }
  }

  async suggest(indexName: string, suggestion: any): Promise<any> {
    try {
      const response = await this.client.search({
        index: indexName,
        body: {
          suggest: suggestion
        }
      })

      return response.suggest
    } catch (error) {
      logger.error('Suggestion operation failed', { 
        indexName, 
        error: error.message 
      })
      throw error
    }
  }

  async scroll(scrollId: string, scrollTime: string = '1m'): Promise<any> {
    try {
      return await this.client.scroll({
        scroll_id: scrollId,
        scroll: scrollTime
      })
    } catch (error) {
      logger.error('Scroll operation failed', { 
        scrollId, 
        error: error.message 
      })
      throw error
    }
  }

  async clearScroll(scrollId: string): Promise<void> {
    try {
      await this.client.clearScroll({
        scroll_id: scrollId
      })
    } catch (error) {
      logger.error('Clear scroll operation failed', { 
        scrollId, 
        error: error.message 
      })
    }
  }

  async getIndexStats(indexName: string): Promise<any> {
    try {
      return await this.client.indices.stats({ index: indexName })
    } catch (error) {
      logger.error('Failed to get index stats', { 
        indexName, 
        error: error.message 
      })
      throw error
    }
  }

  async refreshIndex(indexName: string): Promise<void> {
    try {
      await this.client.indices.refresh({ index: indexName })
      logger.debug('Index refreshed successfully', { indexName })
    } catch (error) {
      logger.error('Failed to refresh index', { 
        indexName, 
        error: error.message 
      })
      throw error
    }
  }

  async reindex(sourceIndex: string, destIndex: string): Promise<any> {
    try {
      return await this.client.reindex({
        body: {
          source: { index: sourceIndex },
          dest: { index: destIndex }
        },
        wait_for_completion: false,
        refresh: true
      })
    } catch (error) {
      logger.error('Reindex operation failed', { 
        sourceIndex, 
        destIndex, 
        error: error.message 
      })
      throw error
    }
  }

  async getTask(taskId: string): Promise<any> {
    try {
      return await this.client.tasks.get({ task_id: taskId })
    } catch (error) {
      logger.error('Failed to get task status', { 
        taskId, 
        error: error.message 
      })
      throw error
    }
  }
}
