import { Job } from 'bull';
import { prisma } from '../../index';
import { io } from '../../index';
import { orderAcceptanceService } from '../../services/orderAcceptance.service';
import { logger } from '../../utils/logger';
import { ProcessingStatus, ActivityType } from '@prisma/client';

interface OrderProcessingJob {
  emailAccountId: string;
  messageId: string;
}

export async function processOrder(job: Job<OrderProcessingJob>) {
  const { emailAccountId, messageId } = job.data;

  try {
    // Get processed email
    const processedEmail = await prisma.processedEmail.findFirst({
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
      logger.error(`Processed email not found: ${messageId}`);
      return { success: false, error: 'Email not found' };
    }

    // Check if already processed
    if (processedEmail.status === ProcessingStatus.ACCEPTED) {
      logger.info(`Order already accepted: ${messageId}`);
      return { success: true, message: 'Already accepted' };
    }

    if (!processedEmail.acceptLink) {
      logger.warn(`No accept link found for: ${messageId}`);
      
      await prisma.processedEmail.update({
        where: { id: processedEmail.id },
        data: {
          status: ProcessingStatus.SKIPPED,
          error: 'No acceptance link found',
        },
      });

      return { success: false, error: 'No accept link' };
    }

    // Update status to processing
    await prisma.processedEmail.update({
      where: { id: processedEmail.id },
      data: { status: ProcessingStatus.PROCESSING },
    });

    // Emit real-time event
    io.emit('order:processing', {
      emailAccountId,
      processedEmailId: processedEmail.id,
      subject: processedEmail.subject,
    });

    // Accept the order
    const startTime = Date.now();
    const result = await orderAcceptanceService.acceptOrder(processedEmail.acceptLink);
    const processingTime = Date.now() - startTime;

    if (result.success) {
      // Update as accepted
      await prisma.processedEmail.update({
        where: { id: processedEmail.id },
        data: {
          status: ProcessingStatus.ACCEPTED,
          acceptedAt: new Date(),
          metadata: {
            ...(processedEmail.metadata as any),
            acceptanceResult: {
              statusCode: result.statusCode,
              responseTime: result.responseTime,
            },
          },
        },
      });

      // Update rule stats
      if (processedEmail.ruleId) {
        await prisma.rule.update({
          where: { id: processedEmail.ruleId },
          data: {
            successCount: { increment: 1 },
          },
        });
      }

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId: processedEmail.emailAccount.userId,
          emailAccountId,
          processedEmailId: processedEmail.id,
          type: ActivityType.ORDER_ACCEPTED,
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
      io.emit('order:accepted', {
        emailAccountId,
        processedEmailId: processedEmail.id,
        subject: processedEmail.subject,
        from: processedEmail.from,
        processingTime,
      });

      logger.info(
        `Order accepted successfully: ${processedEmail.subject} (${processingTime}ms)`
      );

      return {
        success: true,
        processingTime,
        statusCode: result.statusCode,
      };
    } else {
      // Update as failed
      const retryCount = processedEmail.retryCount + 1;
      const maxRetries = 3;

      await prisma.processedEmail.update({
        where: { id: processedEmail.id },
        data: {
          status: retryCount >= maxRetries ? ProcessingStatus.FAILED : ProcessingStatus.PENDING,
          error: result.error,
          retryCount,
        },
      });

      // Update rule stats
      if (processedEmail.ruleId && retryCount >= maxRetries) {
        await prisma.rule.update({
          where: { id: processedEmail.ruleId },
          data: {
            failureCount: { increment: 1 },
          },
        });
      }

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId: processedEmail.emailAccount.userId,
          emailAccountId,
          processedEmailId: processedEmail.id,
          type: ActivityType.ORDER_FAILED,
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
      io.emit('order:failed', {
        emailAccountId,
        processedEmailId: processedEmail.id,
        subject: processedEmail.subject,
        error: result.error,
        retryCount,
      });

      logger.error(`Order acceptance failed: ${processedEmail.subject}`, {
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
  } catch (error: any) {
    logger.error(`Error processing order for ${messageId}:`, error);
    throw error;
  }
}
