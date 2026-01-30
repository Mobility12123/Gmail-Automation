import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { logger } from './utils/logger';
import { initializeJobs } from './jobs';

dotenv.config();

export const prisma = new PrismaClient();

async function startWorker() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
    
    await initializeJobs();
    logger.info('Worker started successfully');

    // Keep worker alive
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down worker');
      await prisma.$disconnect();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down worker');
      await prisma.$disconnect();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  }
}

startWorker();
