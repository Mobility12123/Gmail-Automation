"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processOrder = processOrder;
const index_1 = require("../../index");
const index_2 = require("../../index");
const orderAcceptance_service_1 = require("../../services/orderAcceptance.service");
const logger_1 = require("../../utils/logger");
const client_1 = require("@prisma/client");
async function processOrder(job) {
    const { emailAccountId, messageId } = job.data;
    try {
        // Get processed email
        const processedEmail = await index_1.prisma.processedEmail.findFirst({
            where: {
                emailAccountId,
                messageId,
            },
            include: {
                emailAccount: true,
                rule: true,
            },
        });
        if (!processedEmail) {
            logger_1.logger.error(`Processed email not found: ${messageId}`);
            return { success: false, error: 'Email not found' };
        }
        // Check if already processed
        if (processedEmail.status === client_1.ProcessingStatus.ACCEPTED) {
            logger_1.logger.info(`Order already accepted: ${messageId}`);
            return { success: true, message: 'Already accepted' };
        }
        if (!processedEmail.acceptLink) {
            logger_1.logger.warn(`No accept link found for: ${messageId}`);
            await index_1.prisma.processedEmail.update({
                where: { id: processedEmail.id },
                data: {
                    status: client_1.ProcessingStatus.SKIPPED,
                    error: 'No acceptance link found',
                },
            });
            return { success: false, error: 'No accept link' };
        }
        // Update status to processing
        await index_1.prisma.processedEmail.update({
            where: { id: processedEmail.id },
            data: { status: client_1.ProcessingStatus.PROCESSING },
        });
        // Emit real-time event
        index_2.io.emit('order:processing', {
            emailAccountId,
            processedEmailId: processedEmail.id,
            subject: processedEmail.subject,
        });
        // Accept the order
        const startTime = Date.now();
        const result = await orderAcceptance_service_1.orderAcceptanceService.acceptOrder(processedEmail.acceptLink);
        const processingTime = Date.now() - startTime;
        if (result.success) {
            // Update as accepted
            await index_1.prisma.processedEmail.update({
                where: { id: processedEmail.id },
                data: {
                    status: client_1.ProcessingStatus.ACCEPTED,
                    acceptedAt: new Date(),
                    metadata: {
                        ...processedEmail.metadata,
                        acceptanceResult: {
                            statusCode: result.statusCode,
                            responseTime: result.responseTime,
                        },
                    },
                },
            });
            // Update rule stats
            if (processedEmail.ruleId) {
                await index_1.prisma.rule.update({
                    where: { id: processedEmail.ruleId },
                    data: {
                        successCount: { increment: 1 },
                    },
                });
            }
            // Log activity
            await index_1.prisma.activityLog.create({
                data: {
                    userId: processedEmail.emailAccount.userId,
                    emailAccountId,
                    processedEmailId: processedEmail.id,
                    type: client_1.ActivityType.ORDER_ACCEPTED,
                    title: 'Order accepted',
                    description: `Successfully accepted order from ${processedEmail.from} in ${processingTime}ms`,
                    metadata: {
                        subject: processedEmail.subject,
                        from: processedEmail.from,
                        processingTime,
                        statusCode: result.statusCode,
                    },
                },
            });
            // Emit success event
            index_2.io.emit('order:accepted', {
                emailAccountId,
                processedEmailId: processedEmail.id,
                subject: processedEmail.subject,
                from: processedEmail.from,
                processingTime,
            });
            logger_1.logger.info(`Order accepted successfully: ${processedEmail.subject} (${processingTime}ms)`);
            return {
                success: true,
                processingTime,
                statusCode: result.statusCode,
            };
        }
        else {
            // Update as failed
            const retryCount = processedEmail.retryCount + 1;
            const maxRetries = 3;
            await index_1.prisma.processedEmail.update({
                where: { id: processedEmail.id },
                data: {
                    status: retryCount >= maxRetries ? client_1.ProcessingStatus.FAILED : client_1.ProcessingStatus.PENDING,
                    error: result.error,
                    retryCount,
                },
            });
            // Update rule stats
            if (processedEmail.ruleId && retryCount >= maxRetries) {
                await index_1.prisma.rule.update({
                    where: { id: processedEmail.ruleId },
                    data: {
                        failureCount: { increment: 1 },
                    },
                });
            }
            // Log activity
            await index_1.prisma.activityLog.create({
                data: {
                    userId: processedEmail.emailAccount.userId,
                    emailAccountId,
                    processedEmailId: processedEmail.id,
                    type: client_1.ActivityType.ORDER_FAILED,
                    title: 'Order acceptance failed',
                    description: `Failed to accept order from ${processedEmail.from}: ${result.error}`,
                    metadata: {
                        subject: processedEmail.subject,
                        from: processedEmail.from,
                        error: result.error,
                        retryCount,
                    },
                },
            });
            // Emit failure event
            index_2.io.emit('order:failed', {
                emailAccountId,
                processedEmailId: processedEmail.id,
                subject: processedEmail.subject,
                error: result.error,
                retryCount,
            });
            logger_1.logger.error(`Order acceptance failed: ${processedEmail.subject}`, {
                error: result.error,
                retryCount,
            });
            // Retry if not exceeded max retries
            if (retryCount < maxRetries) {
                throw new Error(result.error); // This will trigger Bull's retry logic
            }
            return {
                success: false,
                error: result.error,
                retryCount,
            };
        }
    }
    catch (error) {
        logger_1.logger.error(`Error processing order for ${messageId}:`, error);
        throw error;
    }
}
//# sourceMappingURL=orderProcessing.processor.js.map