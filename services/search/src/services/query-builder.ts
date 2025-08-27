import { 
  SearchRequest, 
  SearchType, 
  AutocompleteRequest,
  SearchFilters,
  SortOption
} from '../types/search'
import { logger } from '../utils/logger'

export class QueryBuilder {
  private readonly config = {
    minScore: 0.1,
    maxFuzziness: 2,
    defaultOperator: 'and',
    tieBreaker: 0.3,
    boostDecay: 0.5,
    maxExpansions: 50
  }

  buildSearchQuery(request: SearchRequest): any {
    const query: any = {
      size: request.pagination?.size || 20,
      from: ((request.pagination?.page || 1) - 1) * (request.pagination?.size || 20),
      min_score: this.config.minScore,
      timeout: '30s'
    }

    // Build main query
    query.query = this.buildMainQuery(request.query, request.filters)

    // Add sorting
    if (request.sort && request.sort.length > 0) {
      query.sort = this.buildSort(request.sort)
    }

    // Add highlighting
    if (request.highlight) {
      query.highlight = this.buildHighlight()
    }

    // Add aggregations for facets
    query.aggs = this.buildAggregations(request.filters)

    // Add suggestions
    if (request.suggestions) {
      query.suggest = this.buildSuggestions(request.query)
    }

    return query
  }

  buildAutocompleteQuery(request: AutocompleteRequest): any {
    const query: any = {
      size: request.limit || 10,
      _source: ['title', 'name', 'description'],
      timeout: '10s'
    }

    query.query = {
      bool: {
        should: [
          // Prefix matching for immediate results
          {
            multi_match: {
              query: request.query,
              type: 'phrase_prefix',
              fields: [
                'title^3',
                'name^3',
                'titleBoost^2',
                'searchableContent'
              ]
            }
          },
          // Fuzzy matching for typos
          {
            multi_match: {
              query: request.query,
              type: 'best_fields',
              fields: [
                'title^2',
                'name^2',
                'description'
              ],
              fuzziness: 'AUTO',
              prefix_length: 1
            }
          }
        ],
        minimum_should_match: 1
      }
    }

    // Add type filter if specified
    if (request.types && request.types.length > 0) {
      query.query.bool.filter = [
        {
          terms: {
            'searchType.keyword': request.types
          }
        }
      ]
    }

    return query
  }

  private buildMainQuery(queryString: string, filters?: SearchFilters): any {
    const boolQuery: any = {
      bool: {
        must: [],
        should: [],
        filter: [],
        must_not: []
      }
    }

    // Main text search
    if (queryString && queryString.trim()) {
      const textQuery = this.buildTextQuery(queryString)
      boolQuery.bool.must.push(textQuery)
    } else {
      // Match all if no query
      boolQuery.bool.must.push({ match_all: {} })
    }

    // Add filters
    if (filters) {
      const filterQueries = this.buildFilters(filters)
      boolQuery.bool.filter.push(...filterQueries)
    }

    // Add function score for relevance boosting
    return {
      function_score: {
        query: boolQuery,
        functions: this.buildScoreFunctions(),
        score_mode: 'multiply',
        boost_mode: 'multiply'
      }
    }
  }

  private buildTextQuery(queryString: string): any {
    const cleanQuery = queryString.trim()

    return {
      dis_max: {
        queries: [
          // Exact phrase match (highest priority)
          {
            multi_match: {
              query: cleanQuery,
              type: 'phrase',
              fields: [
                'title^10',
                'name^10',
                'titleBoost^8',
                'description^3',
                'contentBoost^3'
              ],
              boost: 3
            }
          },
          // Best fields match
          {
            multi_match: {
              query: cleanQuery,
              type: 'best_fields',
              fields: [
                'title^5',
                'name^5',
                'titleBoost^4',
                'description^2',
                'contentBoost^2',
                'searchableContent^1.5'
              ],
              fuzziness: 'AUTO',
              operator: this.config.defaultOperator,
              boost: 2
            }
          },
          // Cross fields match
          {
            multi_match: {
              query: cleanQuery,
              type: 'cross_fields',
              fields: [
                'title^3',
                'description^2',
                'searchableContent'
              ],
              operator: 'and',
              boost: 1.5
            }
          },
          // Fuzzy match for typos
          {
            multi_match: {
              query: cleanQuery,
              type: 'best_fields',
              fields: [
                'title^2',
                'description',
                'searchableContent'
              ],
              fuzziness: this.config.maxFuzziness,
              prefix_length: 2,
              max_expansions: this.config.maxExpansions
            }
          }
        ],
        tie_breaker: this.config.tieBreaker
      }
    }
  }

  private buildFilters(filters: SearchFilters): any[] {
    const filterQueries: any[] = []

    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      filterQueries.push({
        terms: {
          'category.keyword': filters.categories
        }
      })
    }

    // Difficulty filter
    if (filters.difficulty && filters.difficulty.length > 0) {
      filterQueries.push({
        terms: {
          'difficulty.keyword': filters.difficulty
        }
      })
    }

    // Duration range filter
    if (filters.duration) {
      const rangeQuery: any = {}
      if (filters.duration.min !== undefined) {
        rangeQuery.gte = filters.duration.min
      }
      if (filters.duration.max !== undefined) {
        rangeQuery.lte = filters.duration.max
      }
      
      if (Object.keys(rangeQuery).length > 0) {
        filterQueries.push({
          range: {
            duration: rangeQuery
          }
        })
      }
    }

    // Price range filter
    if (filters.price) {
      const priceQuery: any = {}
      if (filters.price.min !== undefined) {
        priceQuery.gte = filters.price.min
      }
      if (filters.price.max !== undefined) {
        priceQuery.lte = filters.price.max
      }
      
      if (Object.keys(priceQuery).length > 0) {
        filterQueries.push({
          range: {
            price: priceQuery
          }
        })
      }
    }

    // Rating filter
    if (filters.rating !== undefined) {
      filterQueries.push({
        range: {
          rating: {
            gte: filters.rating
          }
        }
      })
    }

    // Language filter
    if (filters.language && filters.language.length > 0) {
      filterQueries.push({
        terms: {
          'language.keyword': filters.language
        }
      })
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      filterQueries.push({
        terms: {
          'tags.keyword': filters.tags
        }
      })
    }

    // Date range filter
    if (filters.dateRange) {
      const dateQuery: any = {}
      if (filters.dateRange.from) {
        dateQuery.gte = filters.dateRange.from
      }
      if (filters.dateRange.to) {
        dateQuery.lte = filters.dateRange.to
      }
      
      if (Object.keys(dateQuery).length > 0) {
        filterQueries.push({
          range: {
            createdAt: dateQuery
          }
        })
      }
    }

    // Author filter
    if (filters.author) {
      filterQueries.push({
        term: {
          'author.keyword': filters.author
        }
      })
    }

    // Status filter
    if (filters.status && filters.status.length > 0) {
      filterQueries.push({
        terms: {
          'status.keyword': filters.status
        }
      })
    }

    return filterQueries
  }

  private buildSort(sortOptions: SortOption[]): any[] {
    const sortQueries: any[] = []

    for (const sort of sortOptions) {
      if (sort.field === '_score') {
        sortQueries.push({ _score: { order: sort.order } })
      } else if (sort.field === 'relevance') {
        sortQueries.push({ _score: { order: 'desc' } })
      } else if (sort.field === 'date') {
        sortQueries.push({ 
          createdAt: { 
            order: sort.order,
            unmapped_type: 'date'
          }
        })
      } else if (sort.field === 'rating') {
        sortQueries.push({ 
          rating: { 
            order: sort.order,
            unmapped_type: 'float'
          }
        })
      } else if (sort.field === 'price') {
        sortQueries.push({ 
          price: { 
            order: sort.order,
            unmapped_type: 'float'
          }
        })
      } else if (sort.field === 'popularity') {
        sortQueries.push({ 
          enrollmentCount: { 
            order: 'desc',
            unmapped_type: 'long'
          }
        })
      } else if (sort.field === 'alphabetical') {
        sortQueries.push({ 
          'title.keyword': { 
            order: sort.order,
            unmapped_type: 'keyword'
          }
        })
      } else {
        // Generic field sort
        const fieldName = sort.field.includes('.') ? sort.field : `${sort.field}.keyword`
        sortQueries.push({
          [fieldName]: {
            order: sort.order,
            unmapped_type: 'keyword'
          }
        })
      }
    }

    // Add tie-breaker
    if (sortQueries.length > 0 && !sortQueries.some(s => s._score)) {
      sortQueries.push({ _score: { order: 'desc' } })
    }

    return sortQueries
  }

  private buildHighlight(): any {
    return {
      pre_tags: ['<mark>'],
      post_tags: ['</mark>'],
      fragment_size: 150,
      number_of_fragments: 3,
      fields: {
        title: {
          fragment_size: 200,
          number_of_fragments: 1
        },
        description: {
          fragment_size: 150,
          number_of_fragments: 2
        },
        content: {
          fragment_size: 150,
          number_of_fragments: 3
        },
        searchableContent: {
          fragment_size: 150,
          number_of_fragments: 2
        }
      }
    }
  }

  private buildAggregations(filters?: SearchFilters): any {
    return {
      categories: {
        terms: {
          field: 'category.keyword',
          size: 20
        }
      },
      difficulty: {
        terms: {
          field: 'difficulty.keyword',
          size: 10
        }
      },
      language: {
        terms: {
          field: 'language.keyword',
          size: 15
        }
      },
      tags: {
        terms: {
          field: 'tags.keyword',
          size: 30
        }
      },
      price_ranges: {
        range: {
          field: 'price',
          ranges: [
            { key: 'free', to: 1 },
            { key: 'low', from: 1, to: 50 },
            { key: 'medium', from: 50, to: 200 },
            { key: 'high', from: 200 }
          ]
        }
      },
      rating_ranges: {
        range: {
          field: 'rating',
          ranges: [
            { key: '4+', from: 4 },
            { key: '3+', from: 3, to: 4 },
            { key: '2+', from: 2, to: 3 },
            { key: '1+', from: 1, to: 2 }
          ]
        }
      },
      duration_ranges: {
        range: {
          field: 'duration',
          ranges: [
            { key: 'short', to: 60 },
            { key: 'medium', from: 60, to: 300 },
            { key: 'long', from: 300 }
          ]
        }
      }
    }
  }

  private buildSuggestions(query: string): any {
    return {
      title_suggestion: {
        text: query,
        term: {
          field: 'title',
          suggest_mode: 'popular'
        }
      },
      content_suggestion: {
        text: query,
        phrase: {
          field: 'searchableContent',
          size: 5,
          real_word_error_likelihood: 0.95,
          confidence: 0.5,
          max_errors: 2,
          gram_size: 3,
          direct_generator: [
            {
              field: 'searchableContent',
              suggest_mode: 'always',
              min_word_length: 2,
              prefix_length: 1
            }
          ]
        }
      }
    }
  }

  private buildScoreFunctions(): any[] {
    return [
      // Boost newer content
      {
        gauss: {
          createdAt: {
            origin: 'now',
            scale: '30d',
            decay: this.config.boostDecay
          }
        },
        weight: 0.3
      },
      // Boost highly rated content
      {
        field_value_factor: {
          field: 'rating',
          factor: 0.2,
          modifier: 'log1p',
          missing: 1
        }
      },
      // Boost popular content
      {
        field_value_factor: {
          field: 'enrollmentCount',
          factor: 0.0001,
          modifier: 'log1p',
          missing: 1
        }
      }
    ]
  }

  // Specialized query builders for different search types
  buildCourseQuery(request: SearchRequest): any {
    const baseQuery = this.buildSearchQuery(request)
    
    // Add course-specific boosts
    baseQuery.query.function_score.functions.push(
      {
        filter: { term: { 'searchType.keyword': SearchType.COURSE } },
        weight: 1.2
      }
    )

    return baseQuery
  }

  buildInstructorQuery(request: SearchRequest): any {
    const baseQuery = this.buildSearchQuery(request)
    
    // Add instructor-specific fields to search
    if (baseQuery.query.function_score.query.bool.must[0]?.dis_max) {
      baseQuery.query.function_score.query.bool.must[0].dis_max.queries.push({
        multi_match: {
          query: request.query,
          type: 'best_fields',
          fields: [
            'name^5',
            'bio^3',
            'expertise^4',
            'qualifications^2'
          ],
          boost: 2
        }
      })
    }

    return baseQuery
  }

  buildContentQuery(request: SearchRequest): any {
    const baseQuery = this.buildSearchQuery(request)
    
    // Add content-specific scoring
    baseQuery.query.function_score.functions.push(
      {
        filter: { 
          bool: {
            should: [
              { term: { 'searchType.keyword': SearchType.CONTENT } },
              { term: { 'searchType.keyword': SearchType.LESSON } }
            ]
          }
        },
        weight: 1.1
      }
    )

    return baseQuery
  }
}
