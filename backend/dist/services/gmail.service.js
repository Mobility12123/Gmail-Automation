"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gmailService = exports.GmailService = void 0;
const googleapis_1 = require("googleapis");
const logger_1 = require("../utils/logger");
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI;
class GmailService {
    oauth2Client;
    constructor() {
        this.oauth2Client = new googleapis_1.google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI);
    }
    getAuthUrl() {
        const scopes = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/gmail.labels',
            'https://www.googleapis.com/auth/userinfo.email',
        ];
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent',
        });
    }
    async getTokensFromCode(code) {
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            return tokens;
        }
        catch (error) {
            logger_1.logger.error('Error getting tokens from code:', error);
            throw new Error('Failed to exchange authorization code for tokens');
        }
    }
    async refreshAccessToken(refreshToken) {
        try {
            this.oauth2Client.setCredentials({ refresh_token: refreshToken });
            const { credentials } = await this.oauth2Client.refreshAccessToken();
            return credentials;
        }
        catch (error) {
            logger_1.logger.error('Error refreshing access token:', error);
            throw new Error('Failed to refresh access token');
        }
    }
    async getUserEmail(accessToken) {
        try {
            this.oauth2Client.setCredentials({ access_token: accessToken });
            const oauth2 = googleapis_1.google.oauth2({ version: 'v2', auth: this.oauth2Client });
            const { data } = await oauth2.userinfo.get();
            return data.email;
        }
        catch (error) {
            logger_1.logger.error('Error getting user email:', error);
            throw new Error('Failed to get user email');
        }
    }
    async watchMailbox(accessToken, topicName) {
        try {
            this.oauth2Client.setCredentials({ access_token: accessToken });
            const gmail = googleapis_1.google.gmail({ version: 'v1', auth: this.oauth2Client });
            // For production, you need to set up Cloud Pub/Sub
            // For now, we'll return a watch response structure
            const response = await gmail.users.watch({
                userId: 'me',
                requestBody: {
                    labelIds: ['INBOX'],
                    topicName: topicName || 'projects/your-project/topics/gmail',
                },
            });
            return {
                historyId: response.data.historyId,
                expiration: response.data.expiration,
            };
        }
        catch (error) {
            // If watch fails (no Pub/Sub setup), we'll fall back to polling
            logger_1.logger.warn('Watch mailbox failed, will use polling:', error.message);
            return null;
        }
    }
    async getMessages(accessToken, maxResults = 10, query) {
        try {
            this.oauth2Client.setCredentials({ access_token: accessToken });
            const gmail = googleapis_1.google.gmail({ version: 'v1', auth: this.oauth2Client });
            const response = await gmail.users.messages.list({
                userId: 'me',
                maxResults,
                q: query,
                labelIds: ['INBOX'],
            });
            if (!response.data.messages) {
                return [];
            }
            const messages = await Promise.all(response.data.messages.map(async (msg) => {
                const fullMessage = await gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id,
                    format: 'full',
                });
                return this.parseMessage(fullMessage.data);
            }));
            return messages;
        }
        catch (error) {
            logger_1.logger.error('Error getting messages:', error);
            throw new Error('Failed to fetch messages');
        }
    }
    async listMessages(accessToken, maxResults = 10, query = 'is:unread') {
        try {
            this.oauth2Client.setCredentials({ access_token: accessToken });
            const gmail = googleapis_1.google.gmail({ version: 'v1', auth: this.oauth2Client });
            const response = await gmail.users.messages.list({
                userId: 'me',
                maxResults,
                q: query,
            });
            return response.data.messages || [];
        }
        catch (error) {
            logger_1.logger.error('Error listing messages:', error);
            return [];
        }
    }
    async getMessage(accessToken, messageId) {
        try {
            this.oauth2Client.setCredentials({ access_token: accessToken });
            const gmail = googleapis_1.google.gmail({ version: 'v1', auth: this.oauth2Client });
            const response = await gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'full',
            });
            return this.parseMessage(response.data);
        }
        catch (error) {
            logger_1.logger.error('Error getting message:', error);
            throw new Error('Failed to fetch message');
        }
    }
    async getHistory(accessToken, startHistoryId) {
        try {
            this.oauth2Client.setCredentials({ access_token: accessToken });
            const gmail = googleapis_1.google.gmail({ version: 'v1', auth: this.oauth2Client });
            const response = await gmail.users.history.list({
                userId: 'me',
                startHistoryId,
                historyTypes: ['messageAdded'],
                labelId: 'INBOX',
            });
            return response.data;
        }
        catch (error) {
            logger_1.logger.error('Error getting history:', error);
            throw new Error('Failed to fetch history');
        }
    }
    async modifyMessage(accessToken, messageId, addLabelIds, removeLabelIds) {
        try {
            this.oauth2Client.setCredentials({ access_token: accessToken });
            const gmail = googleapis_1.google.gmail({ version: 'v1', auth: this.oauth2Client });
            await gmail.users.messages.modify({
                userId: 'me',
                id: messageId,
                requestBody: {
                    addLabelIds,
                    removeLabelIds,
                },
            });
        }
        catch (error) {
            logger_1.logger.error('Error modifying message:', error);
            throw new Error('Failed to modify message');
        }
    }
    async markAsRead(accessToken, messageId) {
        await this.modifyMessage(accessToken, messageId, undefined, ['UNREAD']);
    }
    parseMessage(message) {
        const headers = message.payload?.headers || [];
        const getHeader = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
        const subject = getHeader('Subject');
        const from = getHeader('From');
        const to = getHeader('To').split(',').map((email) => email.trim());
        const date = getHeader('Date');
        const messageId = getHeader('Message-ID');
        // Extract body
        let body = '';
        if (message.payload?.body?.data) {
            body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
        }
        else if (message.payload?.parts) {
            const textPart = message.payload.parts.find((part) => part.mimeType === 'text/plain' || part.mimeType === 'text/html');
            if (textPart?.body?.data) {
                body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
            }
        }
        // Extract links from body
        const links = this.extractLinks(body);
        return {
            id: message.id,
            threadId: message.threadId,
            messageId,
            subject,
            from,
            to,
            date: new Date(date),
            body,
            bodyPreview: body.substring(0, 200),
            links,
            labels: message.labelIds || [],
            snippet: message.snippet,
        };
    }
    extractLinks(body) {
        const urlRegex = /(https?:\/\/[^\s<>"]+)/gi;
        const matches = body.match(urlRegex);
        return matches || [];
    }
    async sendReply(accessToken, threadId, toEmail, subject, body) {
        try {
            this.oauth2Client.setCredentials({ access_token: accessToken });
            const gmail = googleapis_1.google.gmail({ version: 'v1', auth: this.oauth2Client });
            // Prepare email message
            const emailLines = [
                `From: me`,
                `To: ${toEmail}`,
                `Subject: Re: ${subject}`,
                'Content-Type: text/plain; charset="UTF-8"',
                'MIME-Version: 1.0',
                '',
                body,
            ];
            const message = emailLines.join('\n');
            const encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
            const response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    threadId,
                    raw: encodedMessage,
                },
            });
            logger_1.logger.info(`Confirmation email sent to ${toEmail}`, {
                messageId: response.data.id,
                threadId,
            });
            return response.data;
        }
        catch (error) {
            logger_1.logger.error('Error sending reply email:', error);
            throw new Error('Failed to send reply email');
        }
    }
}
exports.GmailService = GmailService;
exports.gmailService = new GmailService();
//# sourceMappingURL=gmail.service.js.map