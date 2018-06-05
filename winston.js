const winston = require("winston");

const level = process.env.LOG_LEVEL || 'debug';

var options = {
    file: {
      name: 'API',
      level: 'info',
      filename: './tmp/logs/app.log',
      handleExceptions: true,
      json: false,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      colorize: false,
    },
    error: {
      name: 'Errors',
      level: 'error',
      filename: './tmp/logs/error.log',
      handleExceptions: true,
      json: false,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      colorize: false,
    },
    warn: {
      name: 'Warning',
      level: 'warn',
      filename: './tmp/logs/app.log',
      handleExceptions: true,
      json: false,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      colorize: false,
    },
    console: {
      level: 'debug',
      handleExceptions: true,
      json: false,
      colorize: true,
    },
  };

const logger = new winston.Logger({
    transports: [
        new winston.transports.File(options.file),
        new winston.transports.File(options.error),
        new winston.transports.File(options.warn),
        new winston.transports.Console(options.console)
    ],
    exitOnError: false,
});

logger.stream = {
    write: function(message, encoding) {
      logger.info(message);
    },
  };

module.exports = logger;