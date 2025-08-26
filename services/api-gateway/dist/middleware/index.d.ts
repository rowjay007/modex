import express from 'express';
export declare const requestId: (req: express.Request, res: express.Response, next: express.NextFunction) => void;
export declare const rateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const jsonParser: import("connect").NextHandleFunction;
export declare const urlencodedParser: import("connect").NextHandleFunction;
export declare const setupMiddleware: (app: express.Application) => void;
//# sourceMappingURL=index.d.ts.map