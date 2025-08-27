import pino from 'pino'

const logLevel = process.env.LOG_LEVEL || 'info'

export const logger = pino({
  level: logLevel,
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label }
    }
  },
  serializers: {
    error: pino.stdSerializers.err
  }
})
