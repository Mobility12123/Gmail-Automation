import { Job } from 'bull';
import { prisma } from '../../index';
import { io } from '../../index';
import { gmailService } from '../../services/gmail.service';
import { ruleMatchingService } from '../../services/ruleMatching.service';
import { scheduleOrderProcessing } from '../../queues';
import { logger } from '../../utils/logger';
import { ActivityType } from '@prisma/client';

interface EmailCheckJob {
  emailAccountId: string;
}

export async function processEmailCheck(job: Job<EmailCheckJob>) {
  const { emailAccountId } = job.data;

  try {
    // Get email account
    const account = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId },
      include: {
        rules: {
          where: { isActive: true },
          orderBy: { priority: 'desc' },
        },
      },
    });

    if (!account || !account.isActive) {
      logger.debug(`Account ${emailAccountId} not found or inactive`);
      return { processed: 0, skipped: 0 };
    }

    // Refresh token if needed
    let accessToken = account.accessToken;
    if (account.tokenExpiry && account.tokenExpiry < new Date()) {
      if (account.refreshToken) {
        try {
          const tokens = await gmailService.refreshAccessToken(account.refreshToken);
          accessToken = tokens.access_token!;
          
          // Update tokens in database
          await prisma.emailAccount.update({
            where: { id: emailAccountId },
            data: {
              accessToken,
              tokenExpiry: tokens.expiry_date 
                ? new Date(tokens.expiry_date)
                : new Date(Date.now() + 3600 * 1000),
            },
          });
        } catch (error) {
          logger.error(`Error refreshing token for ${account.email}:`, error);
          return { error: 'Token refresh failed' };
        }
      } else {
        logger.error(`No refresh token for ${account.email}`);
        return { error: 'No refresh token' };
      }
    }

    // Get recent emails (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const query = `in:inbox after:${Math.floor(fiveMinutesAgo.getTime() / 1000)}`;
    
    const messages = await gmailService.getMessages(accessToken, 20, query);

    // Update last checked
    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: { lastChecked: new Date() },
    });

    let processed = 0;
    let skipped = 0;

    for (const message of messages) {
      // Check if already processed
      const existing = await prisma.processedEmail.findFirst({
        where: {
          emailAccountId,
          messageId: message.id,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Convert message to email data format
      const emailData = {
        from: message.from,
        to: message.to,
        subject: message.subject,
        body: message.body,
        labels: message.labels,
        date: message.date,
      };

      // Find matching rules
      const matchingRules = ruleMatchingService.findMatchingRules(
        emailData,
        account.rules
      );

      if (matchingRules.length > 0) {
        const rule = matchingRules[0]; // Use highest priority rule

        // Extract accept link
        const acceptLink = ruleMatchingService.extractAcceptLink(emailData);

        // Create processed email record
        const processedEmail = await prisma.processedEmail.create({
          data: {
            emailAccountId,
            ruleId: rule.id,
            messageId: message.id,
            threadId: message.threadId,
            subject: message.subject,
            from: message.from,
            to: message.to,
            receivedAt: message.date,
            bodyPreview: message.bodyPreview,
            acceptLink,
            status: acceptLink ? 'PENDING' : 'SKIPPED',
            metadata: {
              links: message.links,
              snippet: message.snippet,
            },
          },
        });

        // Update rule stats
        await prisma.rule.update({
          where: { id: rule.id },
          data: {
            matchCount: { increment: 1 },
            lastMatched: new Date(),
          },
        });

        // Log activity
        await prisma.activityLog.create({
          data: {
            userId: account.userId,
            emailAccountId,
            processedEmailId: processedEmail.id,
            type: ActivityType.RULE_MATCHED,
            title: 'Rule matched',
            description: `Email from ${message.from} matched rule: ${rule.name}`,
            metadata: {
              ruleId: rule.id,
              ruleName: rule.name,
              subject: message.subject,
            },
          },
        });

        // If auto-accept is enabled and we have a link, schedule order processing
        if (rule.autoAccept && acceptLink) {
          await scheduleOrderProcessing(emailAccountId, message.id);
        }

        // Mark as read if configured
        if (rule.markAsRead) {
          try {
            await gmailService.markAsRead(accessToken, message.id);
          } catch (error) {
            logger.error('Error marking email as read:', error);
          }
        }

        // Emit real-time event
        io.emit('email:matched', {
          emailAccountId,
          processedEmailId: processedEmail.id,
          rule: { id: rule.id, name: rule.name },
          subject: message.subject,
          from: message.from,
        });

        processed++;
      } else {
        // No matching rules - still log it
        await prisma.processedEmail.create({
          data: {
            emailAccountId,
            messageId: message.id,
            threadId: message.threadId,
            subject: message.subject,
            from: message.from,
            to: message.to,
            receivedAt: message.date,
            bodyPreview: message.bodyPreview,
            status: 'SKIPPED',
          },
        });

        skipped++;
      }
    }

    logger.info(
      `Email check completed for ${account.email}: ${processed} processed, ${skipped} skipped`
    );

    return { processed, skipped, total: messages.length };
  } catch (error) {
    logger.error(`Error processing email check for ${emailAccountId}:`, error);
    throw error;
  }
}
