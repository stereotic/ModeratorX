/**
 * Prisma database service (Prisma ORM v7 + PostgreSQL driver adapter).
 *
 * Responsibilities:
 * - Own the PrismaClient singleton lifecycle
 * - Connect / disconnect / health-check
 */

import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { createLogger } from '../../shared/logger.js';
import type { EnvConfig } from '../../config/env.config.js';

const log = createLogger('PrismaService');

let prismaInstance: PrismaClient | null = null;

/**
 * Create (or return) the PrismaClient singleton backed by pg adapter.
 */
export function createPrismaClient(config: EnvConfig): PrismaClient {
  if (prismaInstance) {
    return prismaInstance;
  }

  const adapter = new PrismaPg({
    connectionString: config.DATABASE_URL,
  });

  prismaInstance = new PrismaClient({ adapter });
  return prismaInstance;
}

/** Access the already-created PrismaClient */
export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    throw new Error('PrismaClient has not been initialized. Call createPrismaClient() first.');
  }

  return prismaInstance;
}

/** Verify database connectivity */
export async function connectDatabase(client: PrismaClient): Promise<void> {
  try {
    await client.$connect();
    log.info('Database connected');
  } catch (error) {
    log.fatal({ err: error }, 'Failed to connect to database');
    throw error;
  }
}

/** Gracefully disconnect */
export async function disconnectDatabase(): Promise<void> {
  if (!prismaInstance) {
    return;
  }

  await prismaInstance.$disconnect();
  prismaInstance = null;
  log.info('Database disconnected');
}
