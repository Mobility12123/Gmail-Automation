"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationQueue = exports.orderProcessingQueue = exports.emailCheckQueue = void 0;
exports.initializeQueues = initializeQueues;
exports.scheduleEmailCheck = scheduleEmailCheck;
exports.scheduleOrderProcessing = scheduleOrderProcessing;
const bull_1 = __importDefault(require("bull"));
const logger_1 = require("../utils/logger");
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const USE_REDIS = process.env.USE_REDIS !== 'false';
let emailCheckQueue;
let orderProcessingQueue;
let notificationQueue;
// Mock queue for when Redis is not available
class MockQueue {
    name;
    handlers = new Map();
    constructor(name) {
        this.name = name;
    }
    async add(jobName, data, _options) {
        logger_1.logger.info(`Mock queue: Would add job ${jobName} to ${this.name}`, { data });
        // For development without Redis, process immediately
        const handler = this.handlers.get(jobName);
        if (handler) {
            setTimeout(async () => {
                try {
                    await handler({ data });
                }
                catch (error) {
                    logger_1.logger.error(`Mock job ${jobName} failed:`, error);
                }
            }, 100);
        }
        return { id: Date.now() };
    }
    process(jobName, _concurrency, handler) {
        this.handlers.set(jobName, handler);
        logger_1.logger.info(`Mock queue: Registered processor for ${jobName}`);
    }
    on(_event, _handler) {
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
        exports.emailCheckQueue = emailCheckQueue = new bull_1.default('email-check', REDIS_URL, {
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
        exports.orderProcessingQueue = orderProcessingQueue = new bull_1.default('order-processing', REDIS_URL, {
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
        exports.notificationQueue = notificationQueue = new bull_1.default('notifications', REDIS_URL, {
            defaultJobOptions: {
                attempts: 2,
                removeOnComplete: true,
            },
        });
    }
    else {
        throw new Error('Redis disabled');
    }
}
catch (error) {
    logger_1.logger.warn('Redis not available, using mock queues for development');
    exports.emailCheckQueue = emailCheckQueue = new MockQueue('email-check');
    exports.orderProcessingQueue = orderProcessingQueue = new MockQueue('order-processing');
    exports.notificationQueue = notificationQueue = new MockQueue('notifications');
}
// Queue event handlers
if (emailCheckQueue && emailCheckQueue.on) {
    emailCheckQueue.on('completed', (job, result) => {
        logger_1.logger.info(`Email check job ${job.id} completed`, { result });
    });
    emailCheckQueue.on('failed', (job, err) => {
        logger_1.logger.error(`Email check job ${job?.id} failed:`, err);
    });
}
if (orderProcessingQueue && orderProcessingQueue.on) {
    orderProcessingQueue.on('completed', (job, result) => {
        logger_1.logger.info(`Order processing job ${job.id} completed`, { result });
    });
    orderProcessingQueue.on('failed', (job, err) => {
        logger_1.logger.error(`Order processing job ${job?.id} failed:`, err);
    });
}
if (notificationQueue && notificationQueue.on) {
    notificationQueue.on('completed', (job) => {
        logger_1.logger.info(`Notification job ${job.id} sent`);
    });
}
// Initialize queues
async function initializeQueues() {
    try {
        if (USE_REDIS && emailCheckQueue.clean) {
            // Clean old jobs
            await emailCheckQueue.clean(7 * 24 * 60 * 60 * 1000, 'completed'); // 7 days
            await emailCheckQueue.clean(30 * 24 * 60 * 60 * 1000, 'failed'); // 30 days
            await orderProcessingQueue.clean(7 * 24 * 60 * 60 * 1000, 'completed');
            await orderProcessingQueue.clean(30 * 24 * 60 * 60 * 1000, 'failed');
        }
        logger_1.logger.info('Queues initialized successfully');
    }
    catch (error) {
        logger_1.logger.warn('Queues initialization warning (using mock mode):', error);
    }
}
// Add helper functions to add jobs
async function scheduleEmailCheck(emailAccountId) {
    await emailCheckQueue.add('check-inbox', { emailAccountId }, {
        jobId: `check-${emailAccountId}-${Date.now()}`,
    });
}
async function scheduleOrderProcessing(emailAccountId, messageId) {
    await orderProcessingQueue.add('process-order', { emailAccountId, messageId }, {
        jobId: `process-${messageId}`,
        priority: 1, // High priority
    });
}
//# sourceMappingURL=index.js.map