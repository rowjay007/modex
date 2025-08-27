import pino from 'pino'

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = pino({
  name: 'audit-service',
  level: process.env.LOG_LEVEL || 'info',
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'yyyy-mm-dd HH:MM:ss'
      }
    }
  }),
  ...(!isDevelopment && {
    formatters: {
      level: (label) => {
        return { level: label }
      }
    }
  })
})
