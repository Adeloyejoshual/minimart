import pino from 'pino';

// Configure logger for production
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  // In production, we usually want to output JSON for log aggregators.
  // During local development, pino-pretty is helpful for readability.
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

export default logger;