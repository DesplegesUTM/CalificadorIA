'use strict';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[32m',
  http: '\x1b[36m',
  debug: '\x1b[37m',
  reset: '\x1b[0m',
};

const currentLevel = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';

function log(level, message) {
  if (levels[level] > levels[currentLevel]) return;
  const timestamp = new Date().toISOString();
  const color = colors[level] || colors.reset;
  console.log(`${color}[${timestamp}] [${level.toUpperCase()}] ${message}${colors.reset}`);
}

const logger = {
  error: (msg) => log('error', msg),
  warn: (msg) => log('warn', msg),
  info: (msg) => log('info', msg),
  http: (msg) => log('http', msg),
  debug: (msg) => log('debug', msg),
};

module.exports = { logger };
