import { Request, Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth";
import { CreateUserDTO, UpdateUserDTO } from "../models/User";
import { sessionService } from "../services/SessionService";
import { userService } from "../services/UserService";
import { auditService } from "../services/AuditService";
import { catchAsync } from "../utils/catchAsync";
import { signToken } from "../utils/jwt";

const PasswordResetDTO = z.object({
  password: z.string().min(8),
});

export const register = catchAsync(async (req: Request, res: Response) => {
  const userData = CreateUserDTO.parse(req.body);
  const user = await userService.createUser(userData);

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  res.status(201).json({
    status: "success",
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    },
  });
});

export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    res.status(400).json({
      status: "error",
      message: "Verification token is required",
    });
    return;
  }

  await userService.verifyEmail(token);
  res.json({
    status: "success",
    message: "Email verified successfully",
  });
});

export const requestPasswordReset = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({
      status: "error",
      message: "Email is required",
    });
    return;
  }

  await userService.requestPasswordReset(email);
  res.json({
    status: "success",
    message:
      "If an account exists with this email, you will receive password reset instructions",
  });
});

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.query;
  const result = PasswordResetDTO.safeParse(req.body);

  if (!token || typeof token !== "string") {
    res.status(400).json({
      status: "error",
      message: "Reset token is required",
    });
    return;
  }

  if (!result.success) {
    res.status(400).json({
      status: "error",
      message: "Invalid password format",
      errors: result.error.errors,
    });
    return;
  }

  await userService.resetPassword(token, result.data.password);
  res.json({
    status: "success",
    message: "Password reset successfully",
  });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await userService.validateUser(email, password);

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  await sessionService.createSession(user.id, token);

  res.json({
    status: "success",
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    },
  });
});

// Get user profile
export const getProfile = catchAsync(async (req: AuthRequest, res: Response) => {
  const user = await userService.getUserById(req.user!.id);

  res.json({
    status: "success",
    data: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  });
});

export const updateProfile = catchAsync(async (req: AuthRequest, res: Response) => {
  const updateData = UpdateUserDTO.parse(req.body);
  const user = await userService.updateUser(req.user!.id, updateData);

  res.json({
    status: "success",
    data: user,
  });
});

export const getAllUsers = catchAsync(async (_req: Request, res: Response) => {
  const users = await userService.getAllUsers();

  res.json({
    status: "success",
    data: users,
  });
});

export const getUserById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await userService.getUserById(Number(id));

  res.json({
    status: "success",
    data: user,
  });
});

export const deleteAccount = catchAsync(async (req: AuthRequest, res: Response) => {
  await userService.deleteUser(req.user!.id);
  
  await sessionService.invalidateAllUserSessions(req.user!.id);
  
  res.status(204).json({
    status: "success",
    data: null
  });
});

export const exportUserData = catchAsync(async (req: AuthRequest, res: Response) => {
  const userData = await userService.exportUserData(req.user!.id);
  
  // Log data export for compliance
  await auditService.log({
    userId: req.user!.id,
    action: 'DATA_EXPORT',
    details: { timestamp: new Date().toISOString() }
  });
  
  res.json({
    status: "success",
    data: userData
  });
});

export const updateConsent = catchAsync(async (req: AuthRequest, res: Response) => {
  const { cookieConsent, marketingConsent, privacyPolicyAccepted, termsAccepted } = req.body;
  
  await userService.updateUserConsent(req.user!.id, {
    cookieConsent,
    marketingConsent,
    privacyPolicyAccepted,
    termsAccepted
  });
  
  res.json({
    status: "success",
    message: "Consent preferences updated"
  });
});

export const setup2FA = catchAsync(async (req: AuthRequest, res: Response) => {
  const secretData = await userService.generate2FASecret(req.user!.id);
  
  res.json({
    status: "success",
    data: secretData
  });
});

export const verify2FA = catchAsync(async (req: AuthRequest, res: Response) => {
  const { token } = req.body;
  
  if (!token) {
    res.status(400).json({
      status: "error",
      message: "2FA token is required"
    });
    return;
  }
  
  const isValid = await userService.verify2FAToken(req.user!.id, token);
  
  if (!isValid) {
    res.status(401).json({
      status: "error",
      message: "Invalid 2FA token"
    });
    return;
  }
  
  // Enable 2FA for the user
  await userService.enable2FA(req.user!.id);
  
  res.json({
    status: "success",
    message: "Two-factor authentication enabled"
  });
});

export const userController = {
  register,
  login,
  verifyEmail,
  getProfile,
  updateProfile,
  requestPasswordReset,
  resetPassword,
  getAllUsers,
  getUserById,
  deleteAccount,
  exportUserData,
  updateConsent,
  setup2FA,
  verify2FA
};
