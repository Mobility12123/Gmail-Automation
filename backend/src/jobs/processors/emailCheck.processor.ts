import { Job } from 'bull';
import { prisma } from '../../index';
import { io } from '../../index';
import { gmailService } from '../../services/gmail.service';
import { scheduleOrderProcessing } from '../../queues';
import { logger } from '../../utils/logger';
import { ActivityType, Rule } from '@prisma/client';

interface EmailCheckJob {
  emailAccountId: string;
}

interface EmailData {
  from: string;
  to: string;
  subject: string;
  body: string;
  labels: string[];
  date: Date;
}

// Inline helper to match rules against email
function matchesRule(emailData: EmailData, rule: Rule): boolean {
  const conditions = rule.conditions as any;
  
  if (!conditions || (typeof conditions === 'object' && Object.keys(conditions).length === 0)) {
    return false;
  }

  // Handle case where conditions might be a string
  let parsedConditions = conditions;
  if (typeof conditions === 'string') {
    try {
      parsedConditions = JSON.parse(conditions);
    } catch (e) {
      return false;
    }
  }

  const checks: boolean[] = [];

  // Check subject
  if (parsedConditions.matchSubject) {
    checks.push(emailData.subject.toLowerCase().includes(parsedConditions.matchSubject.toLowerCase()));
  }

  // Check from
  if (parsedConditions.matchFrom) {
    checks.push(emailData.from.toLowerCase().includes(parsedConditions.matchFrom.toLowerCase()));
  }

  // Check body
  if (parsedConditions.matchBody && emailData.body) {
    checks.push(emailData.body.toLowerCase().includes(parsedConditions.matchBody.toLowerCase()));
  }

  // If no conditions checked, don't match
  if (checks.length === 0) {
    return false;
  }

  // All checks must pass (AND logic)
  return checks.every(check => check === true);
}

// Find matching rules for an email
function findMatchingRules(emailData: EmailData, rules: Rule[]): Rule[] {
  return rules.filter(rule => matchesRule(emailData, rule));
}

// Extract accept link from email body
function extractAcceptLink(emailData: EmailData): string | null {
  const body = emailData.body || '';
  
  // Look for common accept/confirm link patterns
  const patterns = [
    /https?:\/\/[^\s<>"]*(?:accept|confirm|verify|approve)[^\s<>"]*/gi,
    /https?:\/\/[^\s<>"]*click[^\s<>"]*(?:here|confirm)[^\s<>"]*/gi,
    /href=["'](https?:\/\/[^"']*(?:accept|confirm)[^"']*)["']/gi,
  ];

  for (const pattern of patterns) {
    const matches = body.match(pattern);
    if (matches && matches.length > 0) {
      // Clean up the match
      let link = matches[0];
      link = link.replace(/href=["']/gi, '').replace(/["']$/g, '');
      return link;
    }
  }

  return null;
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
      const matchingRules = findMatchingRules(
        emailData,
        account.rules
      );

      if (matchingRules.length > 0) {
        const rule = matchingRules[0]; // Use highest priority rule

        // Extract accept link
        const acceptLink = extractAcceptLink(emailData);

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

        // If action is ACCEPT and we have an accept link, schedule order processing
        if (rule.action === 'ACCEPT' && acceptLink) {
          await scheduleOrderProcessing(emailAccountId, message.id);
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
