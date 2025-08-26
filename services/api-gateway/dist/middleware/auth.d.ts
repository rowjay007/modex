import express from 'express';
interface AuthenticatedRequest extends express.Request {
    user?: any;
}
export declare const authenticateToken: (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => void;
export declare const optionalAuth: (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => void;
export {};
//# sourceMappingURL=auth.d.ts.map