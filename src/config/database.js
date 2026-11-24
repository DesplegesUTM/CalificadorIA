'use strict';

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

let prisma;

if (!global.__prisma) {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  global.__prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

prisma = global.__prisma;

module.exports = { prisma };
