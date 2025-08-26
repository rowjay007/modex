import { Request, Response } from 'express';
interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
    };
}
export declare class PaymentController {
    createPayment(req: AuthenticatedRequest, res: Response): Promise<void>;
    createSubscription(req: AuthenticatedRequest, res: Response): Promise<void>;
    getPayment(req: AuthenticatedRequest, res: Response): Promise<void>;
    getUserPayments(req: AuthenticatedRequest, res: Response): Promise<void>;
    createRefund(req: AuthenticatedRequest, res: Response): Promise<void>;
    getUserSubscriptions(req: AuthenticatedRequest, res: Response): Promise<void>;
    cancelSubscription(req: AuthenticatedRequest, res: Response): Promise<void>;
    handleWebhook(req: Request, res: Response): Promise<void>;
    getPaymentMethods(req: AuthenticatedRequest, res: Response): Promise<void>;
}
export declare const paymentController: PaymentController;
export {};
