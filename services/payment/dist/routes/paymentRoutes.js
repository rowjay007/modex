"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentController_1 = require("../controllers/paymentController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/payments', auth_1.authenticateToken, paymentController_1.paymentController.createPayment.bind(paymentController_1.paymentController));
router.get('/payments/:paymentId', auth_1.authenticateToken, paymentController_1.paymentController.getPayment.bind(paymentController_1.paymentController));
router.get('/payments', auth_1.authenticateToken, paymentController_1.paymentController.getUserPayments.bind(paymentController_1.paymentController));
router.post('/payments/:paymentId/refund', auth_1.authenticateToken, paymentController_1.paymentController.createRefund.bind(paymentController_1.paymentController));
router.post('/subscriptions', auth_1.authenticateToken, paymentController_1.paymentController.createSubscription.bind(paymentController_1.paymentController));
router.get('/subscriptions', auth_1.authenticateToken, paymentController_1.paymentController.getUserSubscriptions.bind(paymentController_1.paymentController));
router.delete('/subscriptions/:subscriptionId', auth_1.authenticateToken, paymentController_1.paymentController.cancelSubscription.bind(paymentController_1.paymentController));
router.get('/payment-methods', auth_1.authenticateToken, paymentController_1.paymentController.getPaymentMethods.bind(paymentController_1.paymentController));
router.post('/webhooks/stripe', paymentController_1.paymentController.handleWebhook.bind(paymentController_1.paymentController));
exports.default = router;
//# sourceMappingURL=paymentRoutes.js.map