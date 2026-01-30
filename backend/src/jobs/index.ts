import { emailCheckQueue, orderProcessingQueue, initializeQueues, scheduleEmailCheck } from '../queues';
import { processEmailCheck } from './processors/emailCheck.processor';
import { processOrder } from './processors/orderProcessing.processor';
import { logger } from '../utils/logger';
import cron from 'node-cron';
import { prisma } from '../index';

export async function initializeJobs() {
  try {
    // Initialize queues
    await initializeQueues();

    // Set up processors
    emailCheckQueue.process('check-inbox', 5, processEmailCheck);
    orderProcessingQueue.process('process-order', 10, processOrder);

    // Schedule periodic email checks (every 30 seconds for active accounts)
    cron.schedule('*/30 * * * * *', async () => {
      try {
        const activeAccounts = await prisma.emailAccount.findMany({
          where: { isActive: true },
          select: { id: true, email: true },
        });

        for (const account of activeAccounts) {
          await scheduleEmailCheck(account.id);
        }

        logger.debug(`Scheduled email checks for ${activeAccounts.length} accounts`);
      } catch (error) {
        logger.error('Error scheduling email checks:', error);
      }
    });

    // Update system status (every 5 minutes)
    cron.schedule('*/5 * * * *', async () => {
      try {
        await prisma.systemStatus.upsert({
          where: { serviceName: 'email-worker' },
          update: {
            isHealthy: true,
            lastCheck: new Date(),
          },
          create: {
            serviceName: 'email-worker',
            isHealthy: true,
            lastCheck: new Date(),
          },
        });
      } catch (error) {
        logger.error('Error updating system status:', error);
      }
    });

    // Clean up old processed emails (daily at 2 AM)
    cron.schedule('0 2 * * *', async () => {
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const result = await prisma.processedEmail.deleteMany({
          where: {
            createdAt: {
              lt: thirtyDaysAgo,
            },
            status: {
              in: ['ACCEPTED', 'SKIPPED'],
            },
          },
        });
        logger.info(`Cleaned up ${result.count} old processed emails`);
      } catch (error) {
        logger.error('Error cleaning up old emails:', error);
      }
    });

    logger.info('Background jobs initialized successfully');
  } catch (error) {
    logger.error('Error initializing jobs:', error);
    throw error;
  }
}
