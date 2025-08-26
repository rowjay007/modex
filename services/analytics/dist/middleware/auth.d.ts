import { Request, Response, NextFunction } from 'express';
interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
    };
}
export declare function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
export declare function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
export {};
