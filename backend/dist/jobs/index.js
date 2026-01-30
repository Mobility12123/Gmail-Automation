"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeJobs = initializeJobs;
const queues_1 = require("../queues");
const emailCheck_processor_1 = require("./processors/emailCheck.processor");
const orderProcessing_processor_1 = require("./processors/orderProcessing.processor");
const logger_1 = require("../utils/logger");
const node_cron_1 = __importDefault(require("node-cron"));
const index_1 = require("../index");
async function initializeJobs() {
    try {
        // Initialize queues
        await (0, queues_1.initializeQueues)();
        // Set up processors
        queues_1.emailCheckQueue.process('check-inbox', 5, emailCheck_processor_1.processEmailCheck);
        queues_1.orderProcessingQueue.process('process-order', 10, orderProcessing_processor_1.processOrder);
        // Schedule periodic email checks (every 30 seconds for active accounts)
        node_cron_1.default.schedule('*/30 * * * * *', async () => {
            try {
                const activeAccounts = await index_1.prisma.emailAccount.findMany({
                    where: { isActive: true },
                    select: { id: true, email: true },
                });
                for (const account of activeAccounts) {
                    await (0, queues_1.scheduleEmailCheck)(account.id);
                }
                logger_1.logger.debug(`Scheduled email checks for ${activeAccounts.length} accounts`);
            }
            catch (error) {
                logger_1.logger.error('Error scheduling email checks:', error);
            }
        });
        // Update system status (every 5 minutes)
        node_cron_1.default.schedule('*/5 * * * *', async () => {
            try {
                await index_1.prisma.systemStatus.upsert({
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
            }
            catch (error) {
                logger_1.logger.error('Error updating system status:', error);
            }
        });
        // Clean up old processed emails (daily at 2 AM)
        node_cron_1.default.schedule('0 2 * * *', async () => {
            try {
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                const result = await index_1.prisma.processedEmail.deleteMany({
                    where: {
                        createdAt: {
                            lt: thirtyDaysAgo,
                        },
                        status: {
                            in: ['ACCEPTED', 'SKIPPED'],
                        },
                    },
                });
                logger_1.logger.info(`Cleaned up ${result.count} old processed emails`);
            }
            catch (error) {
                logger_1.logger.error('Error cleaning up old emails:', error);
            }
        });
        logger_1.logger.info('Background jobs initialized successfully');
    }
    catch (error) {
        logger_1.logger.error('Error initializing jobs:', error);
        throw error;
    }
}
//# sourceMappingURL=index.js.map