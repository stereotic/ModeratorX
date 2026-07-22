/**
 * Prisma CLI configuration (required in Prisma ORM v7+).
 *
 * Runtime PrismaClient uses a driver adapter separately;
 * this file only configures migrate/generate/studio.
 */

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * DATABASE_URL is required for migrate/studio.
 * A local default keeps `prisma generate` working without a live .env.
 */
const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://postgres:postgres@localhost:5432/x_moderator';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
