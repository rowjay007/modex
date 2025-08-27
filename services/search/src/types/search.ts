export interface SearchRequest {
  query: string
  type?: SearchType[]
  filters?: SearchFilters
  sort?: SortOption[]
  pagination?: Pagination
  highlight?: boolean
  suggestions?: boolean
}

export enum SearchType {
  COURSE = 'course',
  LESSON = 'lesson',
  INSTRUCTOR = 'instructor',
  USER = 'user',
  CONTENT = 'content',
  FORUM_POST = 'forum_post',
  ANNOUNCEMENT = 'announcement'
}

export interface SearchFilters {
  categories?: string[]
  difficulty?: string[]
  duration?: DurationRange
  price?: PriceRange
  rating?: number
  language?: string[]
  tags?: string[]
  dateRange?: DateRange
  author?: string
  status?: string[]
}

export interface DurationRange {
  min?: number // in minutes
  max?: number
}

export interface PriceRange {
  min?: number
  max?: number
  currency?: string
}

export interface DateRange {
  from?: Date
  to?: Date
}

export interface SortOption {
  field: string
  order: 'asc' | 'desc'
}

export interface Pagination {
  page: number
  size: number
}

export interface SearchResponse<T = any> {
  results: SearchResult<T>[]
  total: number
  page: number
  size: number
  took: number
  suggestions?: string[]
  facets?: SearchFacets
}

export interface SearchResult<T = any> {
  id: string
  type: SearchType
  score: number
  source: T
  highlights?: Record<string, string[]>
}

export interface SearchFacets {
  categories?: FacetBucket[]
  difficulty?: FacetBucket[]
  language?: FacetBucket[]
  price?: FacetBucket[]
  rating?: FacetBucket[]
  tags?: FacetBucket[]
}

export interface FacetBucket {
  key: string
  count: number
}

// Document interfaces for indexing
export interface CourseDocument {
  id: string
  title: string
  description: string
  shortDescription?: string
  content?: string
  instructor: InstructorInfo
  category: string
  subcategory?: string
  difficulty: string
  duration: number // in minutes
  price: number
  currency: string
  rating: number
  reviewCount: number
  enrollmentCount: number
  language: string
  tags: string[]
  skills: string[]
  prerequisites: string[]
  learningObjectives: string[]
  status: string
  createdAt: Date
  updatedAt: Date
  publishedAt?: Date
}

export interface LessonDocument {
  id: string
  courseId: string
  title: string
  description: string
  content: string
  type: string // video, text, quiz, assignment
  duration: number
  order: number
  isPreview: boolean
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export interface InstructorDocument {
  id: string
  name: string
  email: string
  bio: string
  expertise: string[]
  experience: string
  qualifications: string[]
  rating: number
  reviewCount: number
  courseCount: number
  studentCount: number
  languages: string[]
  socialLinks: Record<string, string>
  createdAt: Date
}

export interface UserDocument {
  id: string
  name: string
  email: string
  bio?: string
  role: string
  skills: string[]
  interests: string[]
  location?: string
  language: string
  joinedAt: Date
  lastActive: Date
  isActive: boolean
}

export interface ContentDocument {
  id: string
  title: string
  content: string
  type: string
  author: string
  tags: string[]
  category: string
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface ForumPostDocument {
  id: string
  title: string
  content: string
  author: UserInfo
  category: string
  tags: string[]
  replies: number
  views: number
  isAnswered: boolean
  isPinned: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AnnouncementDocument {
  id: string
  title: string
  content: string
  author: UserInfo
  type: string // general, course, system
  priority: string // low, medium, high, urgent
  targetAudience: string[]
  isActive: boolean
  publishedAt: Date
  expiresAt?: Date
}

export interface InstructorInfo {
  id: string
  name: string
  email: string
  rating: number
}

export interface UserInfo {
  id: string
  name: string
  email: string
  avatar?: string
}

// Search analytics
export interface SearchAnalytics {
  id: string
  query: string
  type: SearchType[]
  filters?: SearchFilters
  resultCount: number
  clickedResults?: string[]
  userId?: string
  sessionId?: string
  ipAddress: string
  userAgent: string
  timestamp: Date
  responseTime: number
}

export interface PopularQuery {
  query: string
  count: number
  lastSearched: Date
}

export interface SearchSuggestion {
  text: string
  score: number
  type: SearchType
}

// Indexing configuration
export interface IndexMapping {
  [field: string]: {
    type: string
    analyzer?: string
    properties?: IndexMapping
  }
}

export interface IndexSettings {
  numberOfShards: number
  numberOfReplicas: number
  analysis?: {
    analyzer?: Record<string, any>
    tokenizer?: Record<string, any>
    filter?: Record<string, any>
  }
}

export interface IndexTemplate {
  name: string
  pattern: string
  settings: IndexSettings
  mappings: IndexMapping
}

// Search configuration
export interface SearchConfig {
  defaultSize: number
  maxSize: number
  highlightFragmentSize: number
  highlightNumberOfFragments: number
  suggestionSize: number
  facetSize: number
  timeout: number
}

export interface AutocompleteRequest {
  query: string
  types?: SearchType[]
  limit?: number
}

export interface AutocompleteResponse {
  suggestions: AutocompleteSuggestion[]
  took: number
}

export interface AutocompleteSuggestion {
  text: string
  type: SearchType
  score: number
  id?: string
}

// Search indexing job
export interface IndexingJob {
  id: string
  type: 'full' | 'incremental' | 'single'
  entityType?: SearchType
  entityId?: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress?: number
  totalItems?: number
  processedItems?: number
  errorMessage?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

export interface BulkIndexRequest {
  documents: Array<{
    index: string
    id: string
    document: any
  }>
}

export interface BulkIndexResponse {
  took: number
  errors: boolean
  items: Array<{
    index?: {
      _id: string
      status: number
      error?: any
    }
    update?: {
      _id: string
      status: number
      error?: any
    }
    delete?: {
      _id: string
      status: number
      error?: any
    }
  }>
}
