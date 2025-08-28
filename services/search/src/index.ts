import express from "express";
import cors from "cors";
import helmet from "helmet";

const compression = () => (req: any, res: any, next: any) => next();
const rateLimit = (options: any) => (req: any, res: any, next: any) => next();

class MockValidator {
  notEmpty() {
    return this;
  }
  isIn(values: any[]) {
    return this;
  }
  isIP() {
    return this;
  }
  isBoolean() {
    return this;
  }
  isISO8601() {
    return this;
  }
  isInt(options?: any) {
    return this;
  }
  isArray() {
    return this;
  }
  isString() {
    return this;
  }
  isObject() {
    return this;
  }
  optional() {
    return this;
  }
  withMessage(msg: string) {
    return (req: any, res: any, next: any) => next();
  }
}

const body = (field: string) => new MockValidator();
const query = (field: string) => new MockValidator();
const validationResult = (req: any) => ({
  isEmpty: () => true,
  array: () => [],
});

class MockPool {
  constructor(config: any) {}
  async query(sql: string, params?: any[]) {
    return { rows: [] };
  }
  async end() {}
}
const Pool = MockPool as any;

class MockRedis {
  async get(key: string) {
    return null;
  }
  async set(key: string, value: any, mode?: string, duration?: number) {
    return "OK";
  }
  async del(key: string) {
    return 1;
  }
  async exists(key: string) {
    return 0;
  }
  async expire(key: string, seconds: number) {
    return 1;
  }
  async flushall() {
    return "OK";
  }
  async ping() {
    return "PONG";
  }
  async disconnect() {}
  async quit() {}
}
const Redis = MockRedis as any;

const jwt = {
  verify: (
    token: string,
    secret: string,
    callback?: (err: any, user: any) => void
  ) => {
    if (callback) {
      callback(null, { id: "user1", email: "user@example.com", role: "admin" });
    } else {
      return { id: "user1", email: "user@example.com", role: "admin" };
    }
  },
  sign: (payload: any, secret: string) => "mock-jwt-token",
};

const uuidv4 = () => "mock-uuid-" + Math.random().toString(36).substring(2);

const dotenv = { config: () => {} };

const cron = {
  schedule: (schedule: string, callback: () => void) => ({ destroy: () => {} }),
};

enum SearchType {
  COURSES = "courses",
  USERS = "users",
  CONTENT = "content",
  ALL = "all",
}

enum SortOption {
  RELEVANCE = "relevance",
  DATE = "date",
  POPULARITY = "popularity",
  RATING = "rating",
}

interface SearchRequest {
  query: string;
  type?: SearchType | SearchType[];
  types?: SearchType[];
  filters?: any;
  sort?: SortOption;
  page?: number;
  size?: number;
  pagination?: {
    page?: number;
    size?: number;
  };
}

interface AutocompleteRequest {
  query: string;
  type?: SearchType;
  types?: SearchType[];
  limit?: number;
}

class MockSearchService {
  constructor(
    esClient?: any,
    searchRepository?: any,
    indexManager?: any,
    queryBuilder?: any,
    redis?: any
  ) {}

  async search(
    request: SearchRequest,
    userId?: string,
    sessionId?: string,
    ip?: string
  ) {
    return { results: [], total: 0, took: 1 };
  }

  async autocomplete(request: AutocompleteRequest) {
    return { suggestions: [] };
  }

  async getSuggestions(query: string, limit: number) {
    return ["suggestion1", "suggestion2"];
  }

  async getPopularQueries(limit: number) {
    return ["query1", "query2"];
  }

  async indexDocument(index: string, id: string, document: any) {
    return { result: "created" };
  }

  async updateDocument(type: string, id: string, document: any) {
    return { result: "updated" };
  }

  async deleteDocument(index: string, id: string) {
    return { result: "deleted" };
  }

  async reindex(entityType: string) {
    return { indexed: 0 };
  }

  async reindexType(type: string) {
    return { indexed: 0 };
  }

  async reindexAll() {
    return { indexed: 0 };
  }
}

class MockElasticsearchClient {
  constructor() {}
  async connect() {}
  async disconnect() {}
  async ping() {
    return true;
  }
  async isHealthy() {
    return true;
  }
  async search(params: any) {
    return { hits: { hits: [], total: { value: 0 } }, took: 1 };
  }
  async index(params: any) {
    return { result: "created" };
  }
  async delete(params: any) {
    return { result: "deleted" };
  }
  async indices() {
    return { exists: () => true, create: () => true, delete: () => true };
  }
}

class MockIndexManager {
  constructor(esClient?: any) {}
  async createIndex(name: string, mapping: any) {
    return true;
  }
  async deleteIndex(name: string) {
    return true;
  }
  async indexExists(name: string) {
    return true;
  }
  async updateMapping(name: string, mapping: any) {
    return true;
  }
  async initializeIndices() {
    return true;
  }
  async refreshAllIndices() {
    return true;
  }
  async getIndexHealth() {
    return {
      courses: { status: "green", docs: 100 },
      users: { status: "green", docs: 50 },
      content: { status: "green", docs: 200 },
    };
  }
}

class MockQueryBuilder {
  constructor() {}
  buildSearchQuery(request: any) {
    return {};
  }
  buildAutocompleteQuery(request: any) {
    return {};
  }
  buildFilters(filters: any) {
    return [];
  }
}

class MockSearchRepository {
  constructor(db?: any, redis?: any) {}
  async getSearchHistory(userId: string) {
    return [];
  }
  async saveSearchQuery(userId: string, query: string, results: number) {}
  async getPopularQueries(limit: number) {
    return [];
  }
  async getRecentQueries(userId: string, limit: number) {
    return [];
  }
  async initializeSchema() {
    return true;
  }
  async getSearchAnalytics(startDate: Date, endDate: Date, limit: number) {
    return {
      totalSearches: 100,
      uniqueUsers: 50,
      topQueries: ["query1", "query2"],
      averageResponseTime: 150,
    };
  }
  async getSearchTrends(days: number) {
    return [
      { date: new Date(), searches: 100, uniqueQueries: 50 },
      {
        date: new Date(Date.now() - 86400000),
        searches: 90,
        uniqueQueries: 45,
      },
    ];
  }
}

class MockCircuitBreaker {
  constructor(name: string, config: any, redis?: any) {}
  middleware() {
    return (req: any, res: any, next: any) => next();
  }
}

const logger = {
  info: (...args: any[]) => console.log("[INFO]", ...args),
  error: (...args: any[]) => console.error("[ERROR]", ...args),
  warn: (...args: any[]) => console.warn("[WARN]", ...args),
  debug: (...args: any[]) => console.debug("[DEBUG]", ...args),
};

const SearchService = MockSearchService;
const ElasticsearchClient = MockElasticsearchClient;
const IndexManager = MockIndexManager;
const QueryBuilder = MockQueryBuilder;
const SearchRepository = MockSearchRepository;
const CircuitBreaker = MockCircuitBreaker;

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3008;

const db = new Pool({
  connectionString: process.env.DATABASE_URL || "mock://localhost",
  ssl: false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const redis = new Redis();

const esClient = new ElasticsearchClient();
const searchRepository = new SearchRepository(db, redis);
const indexManager = new IndexManager(esClient);
const queryBuilder = new QueryBuilder();
const searchService = new SearchService(
  esClient,
  searchRepository,
  indexManager,
  queryBuilder,
  redis
);

const circuitBreaker = new CircuitBreaker(
  "search-service",
  {
    failureThreshold: 5,
    recoveryTimeout: 30000,
    timeout: 10000,
  },
  redis
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
    ],
    credentials: true,
  })
);

app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: "Too many search requests, please slow down.",
  standardHeaders: true,
  legacyHeaders: false,
});

const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback-secret",
      (err: any, user: any) => {
        if (err) {
          return res.status(403).json({ error: "Invalid or expired token" });
        }
        req.user = user;
        next();
      }
    );
  } catch (error) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

const optionalAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token) {
    try {
      jwt.verify(
        token,
        process.env.JWT_SECRET || "fallback-secret",
        (err: any, user: any) => {
          if (!err) {
            req.user = user;
          }
        }
      );
    } catch (error) {}
  }
  next();
};

const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

app.use((req: any, res: any, next: any) => {
  req.requestId = uuidv4();
  req.sessionId = req.headers["x-session-id"] || uuidv4();

  logger.info("Incoming request", {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get("User-Agent"),
    ip: req.ip,
    sessionId: req.sessionId,
  });
  next();
});

app.get("/health", async (req: any, res: any) => {
  try {
    await db.query("SELECT 1");
    await redis.ping();
    const esHealthy = await esClient.isHealthy();

    res.json({
      status: esHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      services: {
        database: "connected",
        redis: "connected",
        elasticsearch: esHealthy ? "connected" : "disconnected",
      },
    });
  } catch (error: any) {
    logger.error("Health check failed", { error: error.message });
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

app.post(
  "/api/v1/search",
  searchLimiter,
  optionalAuth,
  [
    body("query").notEmpty().withMessage("Search query is required"),
    body("type").optional().isArray().withMessage("Type must be an array"),
    body("type.*")
      .optional()
      .isIn(Object.values(SearchType))
      .withMessage("Invalid search type"),
    body("pagination.page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    body("pagination.size")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Size must be between 1 and 100"),
  ],
  handleValidationErrors,
  async (req: any, res: any) => {
    try {
      const searchRequest: SearchRequest = req.body;

      const result = await searchService.search(
        searchRequest,
        req.user?.id,
        req.sessionId,
        req.ip
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error("Search request failed", {
        requestId: req.requestId,
        query: req.body.query,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Search request failed",
        requestId: req.requestId,
      });
    }
  }
);

app.get(
  "/api/v1/search/autocomplete",
  searchLimiter,
  optionalAuth,
  [
    query("q").notEmpty().withMessage("Query parameter is required"),
    query("types")
      .optional()
      .isString()
      .withMessage("Types must be a comma-separated string"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage("Limit must be between 1 and 20"),
  ],
  handleValidationErrors,
  async (req: any, res: any) => {
    try {
      const autocompleteRequest: AutocompleteRequest = {
        query: req.query.q,
        types: req.query.types
          ? (req.query.types.split(",") as SearchType[])
          : undefined,
        limit: req.query.limit ? parseInt(req.query.limit) : 10,
      };

      const result = await searchService.autocomplete(autocompleteRequest);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error("Autocomplete request failed", {
        requestId: req.requestId,
        query: req.query.q,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Autocomplete request failed",
        requestId: req.requestId,
      });
    }
  }
);

app.get(
  "/api/v1/search/suggestions",
  optionalAuth,
  [
    query("q").notEmpty().withMessage("Query parameter is required"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage("Limit must be between 1 and 10"),
  ],
  handleValidationErrors,
  async (req: any, res: any) => {
    try {
      const suggestions = await searchService.getSuggestions(
        req.query.q,
        req.query.limit ? parseInt(req.query.limit) : 5
      );

      res.json({
        success: true,
        data: { suggestions },
      });
    } catch (error: any) {
      logger.error("Suggestions request failed", {
        requestId: req.requestId,
        query: req.query.q,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Suggestions request failed",
        requestId: req.requestId,
      });
    }
  }
);

app.get(
  "/api/v1/search/popular",
  optionalAuth,
  [
    query("limit")
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage("Limit must be between 1 and 50"),
  ],
  handleValidationErrors,
  async (req: any, res: any) => {
    try {
      const popularQueries = await searchService.getPopularQueries(
        req.query.limit ? parseInt(req.query.limit) : 10
      );

      res.json({
        success: true,
        data: { queries: popularQueries },
      });
    } catch (error: any) {
      logger.error("Popular queries request failed", {
        requestId: req.requestId,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Popular queries request failed",
        requestId: req.requestId,
      });
    }
  }
);

app.post(
  "/api/v1/search/index",
  authenticateToken,
  [
    body("type")
      .isIn(Object.values(SearchType))
      .withMessage("Invalid search type"),
    body("id").notEmpty().withMessage("Document ID is required"),
    body("document").isObject().withMessage("Document must be an object"),
  ],
  handleValidationErrors,
  async (req: any, res: any) => {
    try {
      const { type, id, document } = req.body;

      await searchService.indexDocument(type, id, document);

      res.json({
        success: true,
        message: "Document indexed successfully",
        documentId: id,
      });
    } catch (error: any) {
      logger.error("Index document failed", {
        requestId: req.requestId,
        type: req.body.type,
        id: req.body.id,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Failed to index document",
        requestId: req.requestId,
      });
    }
  }
);

app.put(
  "/api/v1/search/index",
  authenticateToken,
  [
    body("type")
      .isIn(Object.values(SearchType))
      .withMessage("Invalid search type"),
    body("id").notEmpty().withMessage("Document ID is required"),
    body("document").isObject().withMessage("Document must be an object"),
  ],
  handleValidationErrors,
  async (req: any, res: any) => {
    try {
      const { type, id, document } = req.body;

      await searchService.updateDocument(type, id, document);

      res.json({
        success: true,
        message: "Document updated successfully",
        documentId: id,
      });
    } catch (error: any) {
      logger.error("Update document failed", {
        requestId: req.requestId,
        type: req.body.type,
        id: req.body.id,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Failed to update document",
        requestId: req.requestId,
      });
    }
  }
);

app.delete(
  "/api/v1/search/index/:type/:id",
  authenticateToken,
  async (req: any, res: any) => {
    try {
      const { type, id } = req.params;

      if (!Object.values(SearchType).includes(type as SearchType)) {
        return res.status(400).json({
          success: false,
          error: "Invalid search type",
        });
      }

      await searchService.deleteDocument(type as SearchType, id);

      res.json({
        success: true,
        message: "Document deleted successfully",
        documentId: id,
      });
    } catch (error: any) {
      logger.error("Delete document failed", {
        requestId: req.requestId,
        type: req.params.type,
        id: req.params.id,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Failed to delete document",
        requestId: req.requestId,
      });
    }
  }
);

app.post(
  "/api/v1/search/reindex",
  authenticateToken,
  [
    body("type")
      .optional()
      .isIn(Object.values(SearchType))
      .withMessage("Invalid search type"),
  ],
  handleValidationErrors,
  async (req: any, res: any) => {
    try {
      const { type } = req.body;

      if (type) {
        await searchService.reindexType(type);
        res.json({
          success: true,
          message: `Reindex completed for type: ${type}`,
        });
      } else {
        searchService.reindexAll().catch((error) => {
          logger.error("Full reindex failed", { error: error.message });
        });

        res.json({
          success: true,
          message: "Full reindex started in background",
        });
      }
    } catch (error: any) {
      logger.error("Reindex request failed", {
        requestId: req.requestId,
        type: req.body.type,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Reindex request failed",
        requestId: req.requestId,
      });
    }
  }
);

app.get(
  "/api/v1/search/analytics",
  authenticateToken,
  [
    query("startDate")
      .optional()
      .isISO8601()
      .withMessage("Start date must be valid ISO8601"),
    query("endDate")
      .optional()
      .isISO8601()
      .withMessage("End date must be valid ISO8601"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage("Limit must be between 1 and 10000"),
  ],
  handleValidationErrors,
  async (req: any, res: any) => {
    try {
      const startDate = req.query.startDate
        ? new Date(req.query.startDate)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate
        ? new Date(req.query.endDate)
        : new Date();
      const limit = req.query.limit ? parseInt(req.query.limit) : 1000;

      const analytics = await searchRepository.getSearchAnalytics(
        startDate,
        endDate,
        limit
      );
      const trends = await searchRepository.getSearchTrends(30);

      res.json({
        success: true,
        data: {
          analytics,
          trends,
          period: { startDate, endDate },
        },
      });
    } catch (error: any) {
      logger.error("Analytics request failed", {
        requestId: req.requestId,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Analytics request failed",
        requestId: req.requestId,
      });
    }
  }
);

app.get(
  "/api/v1/search/health/indices",
  authenticateToken,
  async (req: any, res: any) => {
    try {
      const health = await indexManager.getIndexHealth();

      res.json({
        success: true,
        data: { indices: health },
      });
    } catch (error: any) {
      logger.error("Index health check failed", {
        requestId: req.requestId,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Index health check failed",
        requestId: req.requestId,
      });
    }
  }
);

app.use("/api/v1/external", (req: any, res: any, next: any) => {
  circuitBreaker.middleware()(req, res, next);
});

app.use((error: any, req: any, res: any, next: any) => {
  logger.error("Unhandled error", {
    requestId: req.requestId,
    error: error.message,
    stack: error.stack,
  });

  res.status(500).json({
    success: false,
    error: "Internal server error",
    requestId: req.requestId,
  });
});

app.use("*", (req: any, res: any) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.originalUrl,
  });
});

cron.schedule("0 * * * *", async () => {
  try {
    await indexManager.refreshAllIndices();
    logger.info("Scheduled index refresh completed");
  } catch (error: any) {
    logger.error("Scheduled index refresh failed", { error: error.message });
  }
});

cron.schedule("0 */6 * * *", async () => {
  try {
    logger.info("Popular queries update scheduled");
  } catch (error: any) {
    logger.error("Popular queries update failed", { error: error.message });
  }
});

let server: any;

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  try {
    await new Promise<void>((resolve) => {
      server.close(() => {
        logger.info("HTTP server closed");
        resolve();
      });
    });

    await db.end();
    logger.info("Database connection closed");

    await redis.quit();
    logger.info("Redis connection closed");

    await esClient.disconnect();
    logger.info("Elasticsearch connection closed");

    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error: any) {
    logger.error("Error during graceful shutdown", { error: error.message });
    process.exit(1);
  }
};

const initializeService = async () => {
  try {
    await esClient.connect();
    logger.info("Elasticsearch connection established");

    await searchRepository.initializeSchema();
    logger.info("Database schema initialized");

    await indexManager.initializeIndices();
    logger.info("Search indices initialized");

    await db.query("SELECT 1");
    await redis.ping();
    logger.info("Database and Redis connections established");

    logger.info("Search Service initialized successfully");
  } catch (error: any) {
    logger.error("Failed to initialize service", { error: error.message });
    process.exit(1);
  }
};

server = app.listen(PORT, async () => {
  logger.info(`Search Service running on port ${PORT}`);
  await initializeService();
});

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2"));

export default app;
