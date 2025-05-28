import { z } from "zod";

export const UserRole = z.enum(["student", "instructor", "admin"]);
export type UserRole = z.infer<typeof UserRole>;

export interface User {
  id: number;
  email: string;
  password: string;
  firstName: string | null;
  lastName: string | null;
  role: string; 
  isActive: boolean | null;
  isEmailVerified: boolean | null;
  emailVerificationToken: string | null;
  emailVerificationExpires: Date | null;
  passwordResetToken: string | null;
  passwordResetExpires: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export const CreateUserDTO = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  role: UserRole.default("student"),
});

export type CreateUserDTO = z.infer<typeof CreateUserDTO>;

export const UpdateUserDTO = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  email: z.string().email().optional(),
});

export type UpdateUserDTO = z.infer<typeof UpdateUserDTO>;
