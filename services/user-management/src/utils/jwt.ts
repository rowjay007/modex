import jwt from 'jsonwebtoken';
import { config } from '../config';

interface JwtPayload {
  id: number;
  email: string;
  role: string;
}

export const signToken = (payload: JwtPayload): string => {
  const secret: any = config.jwtSecret;
  const options: any = { expiresIn: config.jwtExpiresIn };
  return jwt.sign(payload, secret, options);
};
