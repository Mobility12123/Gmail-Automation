import { prisma } from '../index';
import { gmailService } from './gmail.service';
import { ruleEngine } from './ruleEngine';
import { logger } from '../utils/logger';

function isValid(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

export class EmailPoller {
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Start polling for new emails for an email account
   */
  startPolling(emailAccountId: string, intervalMs: number = 10000) {
    // Clear existing interval if any
    if (this.pollingIntervals.has(emailAccountId)) {
      clearInterval(this.pollingIntervals.get(emailAccountId)!);
    }

    // Poll immediately on start
    this.pollEmailAccount(emailAccountId);

    // Then poll at regular intervals
    const interval = setInterval(() => {
      this.pollEmailAccount(emailAccountId);
    }, intervalMs);

    this.pollingIntervals.set(emailAccountId, interval);
    logger.info(`Started polling for email account: ${emailAccountId}`);
  }

  /**
   * Stop polling for an email account
   */
  stopPolling(emailAccountId: string) {
    const interval = this.pollingIntervals.get(emailAccountId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(emailAccountId);
      logger.info(`Stopped polling for email account: ${emailAccountId}`);
    }
  }

  /**
   * Poll a single email account for new messages
   */
  private async pollEmailAccount(emailAccountId: string) {
    try {
      const emailAccount = await prisma.emailAccount.findUnique({
        where: { id: emailAccountId },
      });

      if (!emailAccount) {
        logger.warn(`Email account not found: ${emailAccountId}`);
        return;
      }

      // Get unread messages
      const messages = await gmailService.listMessages(emailAccount.accessToken);

      if (!messages || messages.length === 0) {
        return;
      }

      // Process each message
      for (const message of messages) {
        await this.processMessage(emailAccount, message);
      }
    } catch (error) {
      logger.error(`Error polling email account ${emailAccountId}:`, error);
    }
  }

  /**
   * Process a single Gmail message
   */
  private async processMessage(emailAccount: any, message: any) {
    try {
      // Check if already processed
      const existingEmail = await prisma.processedEmail.findFirst({
        where: {
          emailAccountId: emailAccount.id,
          messageId: message.id,
        },
      });

      if (existingEmail) {
        return; // Already processed
      }

      // Get full message details (already parsed by gmailService)
      const parsedMessage = await gmailService.getMessage(
        emailAccount.accessToken,
        message.id
      );

      if (!parsedMessage) {
        logger.warn(`Could not fetch full message: ${message.id}`);
        return;
      }

      // Build email data from already-parsed message
      const emailData = {
        emailAccountId: emailAccount.id,
        messageId: parsedMessage.id,
        threadId: parsedMessage.threadId,
        subject: parsedMessage.subject || '',
        from: parsedMessage.from || '',
        to: Array.isArray(parsedMessage.to) ? parsedMessage.to : [parsedMessage.to].filter(Boolean),
        receivedAt: parsedMessage.date instanceof Date ? parsedMessage.date : new Date(),
        bodyPreview: parsedMessage.bodyPreview || parsedMessage.snippet || '',
      };

      // Run through rule engine
      await ruleEngine.processEmail(emailData);

      logger.info(`Processed message: ${emailData.subject}`);
    } catch (error) {
      logger.error(`Error processing message:`, error);
    }
  }

  /**
   * Parse Gmail message into EmailData format
   */
  private parseEmailData(fullMessage: any, emailAccountId: string) {
    const headers = fullMessage.payload?.headers || [];

    const getHeader = (name: string) => {
      const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    const from = getHeader('from');
    const to = getHeader('to')
      .split(',')
      .map((email: string) => email.trim())
      .filter((email: string) => email);
    const subject = getHeader('subject');
    const bodyPreview = fullMessage.snippet || '';

    // Parse internalDate (milliseconds since epoch as string)
    const internalDateMs = parseInt(fullMessage.internalDate || Date.now().toString());
    const receivedAt = new Date(internalDateMs);

    return {
      emailAccountId,
      messageId: fullMessage.id,
      threadId: fullMessage.threadId,
      subject,
      from,
      to: to.length > 0 ? to : [],
      receivedAt: isValid(receivedAt) ? receivedAt : new Date(),
      bodyPreview,
    };
  }

  /**
   * Start polling for all active email accounts
   */
  async startPollingAll() {
    try {
      const emailAccounts = await prisma.emailAccount.findMany();

      for (const account of emailAccounts) {
        this.startPolling(account.id);
      }

      logger.info(`Started polling for ${emailAccounts.length} email accounts`);
    } catch (error) {
      logger.error('Error starting polling for all accounts:', error);
    }
  }

  /**
   * Stop polling for all email accounts
   */
  stopPollingAll() {
    for (const [emailAccountId] of this.pollingIntervals) {
      this.stopPolling(emailAccountId);
    }
  }
}

export const emailPoller = new EmailPoller();
