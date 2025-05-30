import pino from 'pino';
import { config } from '../config';

// Configure Pino logger
export const logger = pino({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  transport: config.nodeEnv !== 'production' 
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      } 
    : undefined,
  base: { env: config.nodeEnv },
  timestamp: pino.stdTimeFunctions.isoTime
});

