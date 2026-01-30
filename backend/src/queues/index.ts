import Queue from 'bull';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const USE_REDIS = process.env.USE_REDIS !== 'false';

let emailCheckQueue: any;
let orderProcessingQueue: any;
let notificationQueue: any;

// Mock queue for when Redis is not available
class MockQueue {
  private name: string;
  private handlers: Map<string, Function> = new Map();

  constructor(name: string) {
    this.name = name;
  }

  async add(jobName: string, data: any, options?: any) {
    logger.info(`Mock queue: Would add job ${jobName} to ${this.name}`, { data });
    // For development without Redis, process immediately
    const handler = this.handlers.get(jobName);
    if (handler) {
      setTimeout(async () => {
        try {
          await handler({ data });
        } catch (error) {
          logger.error(`Mock job ${jobName} failed:`, error);
        }
      }, 100);
    }
    return { id: Date.now() };
  }

  process(jobName: string, concurrency: number, handler: Function) {
    this.handlers.set(jobName, handler);
    logger.info(`Mock queue: Registered processor for ${jobName}`);
  }

  on(event: string, handler: Function) {
    // Mock event handler
  }

  async clean() {
    // No-op for mock
  }

  async close() {
    // No-op for mock
  }
}

// Try to create real queues, fall back to mock if Redis not available
try {
  if (USE_REDIS) {
    emailCheckQueue = new Queue('email-check', REDIS_URL, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    });

    orderProcessingQueue = new Queue('order-processing', REDIS_URL, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: 100,
        removeOnFail: false,
      },
    });

    notificationQueue = new Queue('notifications', REDIS_URL, {
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: true,
      },
    });
  } else {
    throw new Error('Redis disabled');
  }
} catch (error) {
  logger.warn('Redis not available, using mock queues for development');
  emailCheckQueue = new MockQueue('email-check');
  orderProcessingQueue = new MockQueue('order-processing');
  notificationQueue = new MockQueue('notifications');
}

export { emailCheckQueue, orderProcessingQueue, notificationQueue };

// Queue event handlers
if (emailCheckQueue && emailCheckQueue.on) {
  emailCheckQueue.on('completed', (job: any, result: any) => {
    logger.info(`Email check job ${job.id} completed`, { result });
  });

  emailCheckQueue.on('failed', (job: any, err: any) => {
    logger.error(`Email check job ${job?.id} failed:`, err);
  });
}

if (orderProcessingQueue && orderProcessingQueue.on) {
  orderProcessingQueue.on('completed', (job: any, result: any) => {
    logger.info(`Order processing job ${job.id} completed`, { result });
  });

  orderProcessingQueue.on('failed', (job: any, err: any) => {
    logger.error(`Order processing job ${job?.id} failed:`, err);
  });
}

if (notificationQueue && notificationQueue.on) {
  notificationQueue.on('completed', (job: any) => {
    logger.info(`Notification job ${job.id} sent`);
  });
}

// Initialize queues
export async function initializeQueues() {
  try {
    if (USE_REDIS && emailCheckQueue.clean) {
      // Clean old jobs
      await emailCheckQueue.clean(7 * 24 * 60 * 60 * 1000, 'completed'); // 7 days
      await emailCheckQueue.clean(30 * 24 * 60 * 60 * 1000, 'failed'); // 30 days
      
      await orderProcessingQueue.clean(7 * 24 * 60 * 60 * 1000, 'completed');
      await orderProcessingQueue.clean(30 * 24 * 60 * 60 * 1000, 'failed');
    }

    logger.info('Queues initialized successfully');
  } catch (error) {
    logger.warn('Queues initialization warning (using mock mode):', error);
  }
}

// Add helper functions to add jobs
export async function scheduleEmailCheck(emailAccountId: string) {
  await emailCheckQueue.add(
    'check-inbox',
    { emailAccountId },
    {
      jobId: `check-${emailAccountId}-${Date.now()}`,
    }
  );
}

export async function scheduleOrderProcessing(
  emailAccountId: string,
  messageId: string
) {
  await orderProcessingQueue.add(
    'process-order',
    { emailAccountId, messageId },
    {
      jobId: `process-${messageId}`,
      priority: 1, // High priority
    }
  );
}
