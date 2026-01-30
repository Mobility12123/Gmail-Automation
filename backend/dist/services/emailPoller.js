"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailPoller = exports.EmailPoller = void 0;
const index_1 = require("../index");
const gmail_service_1 = require("./gmail.service");
const ruleEngine_1 = require("./ruleEngine");
const logger_1 = require("../utils/logger");
function isValid(date) {
    return date instanceof Date && !isNaN(date.getTime());
}
class EmailPoller {
    pollingIntervals = new Map();
    /**
     * Start polling for new emails for an email account
     */
    startPolling(emailAccountId, intervalMs = 10000) {
        // Clear existing interval if any
        if (this.pollingIntervals.has(emailAccountId)) {
            clearInterval(this.pollingIntervals.get(emailAccountId));
        }
        // Poll immediately on start
        this.pollEmailAccount(emailAccountId);
        // Then poll at regular intervals
        const interval = setInterval(() => {
            this.pollEmailAccount(emailAccountId);
        }, intervalMs);
        this.pollingIntervals.set(emailAccountId, interval);
        logger_1.logger.info(`Started polling for email account: ${emailAccountId}`);
    }
    /**
     * Stop polling for an email account
     */
    stopPolling(emailAccountId) {
        const interval = this.pollingIntervals.get(emailAccountId);
        if (interval) {
            clearInterval(interval);
            this.pollingIntervals.delete(emailAccountId);
            logger_1.logger.info(`Stopped polling for email account: ${emailAccountId}`);
        }
    }
    /**
     * Poll a single email account for new messages
     */
    async pollEmailAccount(emailAccountId) {
        try {
            const emailAccount = await index_1.prisma.emailAccount.findUnique({
                where: { id: emailAccountId },
            });
            if (!emailAccount) {
                logger_1.logger.warn(`Email account not found: ${emailAccountId}`);
                return;
            }
            // Get unread messages
            const messages = await gmail_service_1.gmailService.listMessages(emailAccount.accessToken);
            if (!messages || messages.length === 0) {
                return;
            }
            // Process each message
            for (const message of messages) {
                await this.processMessage(emailAccount, message);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error polling email account ${emailAccountId}:`, error);
        }
    }
    /**
     * Process a single Gmail message
     */
    async processMessage(emailAccount, message) {
        try {
            // Check if already processed
            const existingEmail = await index_1.prisma.processedEmail.findFirst({
                where: {
                    emailAccountId: emailAccount.id,
                    messageId: message.id,
                },
            });
            if (existingEmail) {
                return; // Already processed
            }
            // Get full message details (already parsed by gmailService)
            const parsedMessage = await gmail_service_1.gmailService.getMessage(emailAccount.accessToken, message.id);
            if (!parsedMessage) {
                logger_1.logger.warn(`Could not fetch full message: ${message.id}`);
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
            await ruleEngine_1.ruleEngine.processEmail(emailData);
            logger_1.logger.info(`Processed message: ${emailData.subject}`);
        }
        catch (error) {
            logger_1.logger.error(`Error processing message:`, error);
        }
    }
    /**
     * Parse Gmail message into EmailData format
     * @deprecated Use inline parsing instead - kept for reference
     */
    // @ts-ignore - Kept for future reference
    _parseEmailData(fullMessage, emailAccountId) {
        const headers = fullMessage.payload?.headers || [];
        const getHeader = (name) => {
            const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
            return header?.value || '';
        };
        const from = getHeader('from');
        const to = getHeader('to')
            .split(',')
            .map((email) => email.trim())
            .filter((email) => email);
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
            const emailAccounts = await index_1.prisma.emailAccount.findMany();
            for (const account of emailAccounts) {
                this.startPolling(account.id);
            }
            logger_1.logger.info(`Started polling for ${emailAccounts.length} email accounts`);
        }
        catch (error) {
            logger_1.logger.error('Error starting polling for all accounts:', error);
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
exports.EmailPoller = EmailPoller;
exports.emailPoller = new EmailPoller();
//# sourceMappingURL=emailPoller.js.map