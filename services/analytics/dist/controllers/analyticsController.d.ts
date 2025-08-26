import { Request, Response } from 'express';
interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
    };
}
export declare class AnalyticsController {
    trackEvent(req: Request, res: Response): Promise<void>;
    getCourseAnalytics(req: AuthenticatedRequest, res: Response): Promise<void>;
    getUserProgress(req: AuthenticatedRequest, res: Response): Promise<void>;
    getDashboardAnalytics(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateUserProgress(req: AuthenticatedRequest, res: Response): Promise<void>;
    getMyProgress(req: AuthenticatedRequest, res: Response): Promise<void>;
    processBatchedEvents(req: Request, res: Response): Promise<void>;
}
export {};
