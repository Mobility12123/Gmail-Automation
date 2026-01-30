import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../utils/logger';

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID!;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET!;
const GMAIL_REDIRECT_URI = process.env.GMAIL_REDIRECT_URI!;

export class GmailService {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET,
      GMAIL_REDIRECT_URI
    );
  }

  getAuthUrl(): string {
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

  async getTokensFromCode(code: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      return tokens;
    } catch (error) {
      logger.error('Error getting tokens from code:', error);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      return credentials;
    } catch (error) {
      logger.error('Error refreshing access token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  async getUserEmail(accessToken: string): Promise<string> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const { data } = await oauth2.userinfo.get();
      return data.email!;
    } catch (error) {
      logger.error('Error getting user email:', error);
      throw new Error('Failed to get user email');
    }
  }

  async watchMailbox(accessToken: string, topicName?: string) {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      
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
    } catch (error: any) {
      // If watch fails (no Pub/Sub setup), we'll fall back to polling
      logger.warn('Watch mailbox failed, will use polling:', error.message);
      return null;
    }
  }

  async getMessages(
    accessToken: string,
    maxResults: number = 10,
    query?: string
  ) {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: query,
        labelIds: ['INBOX'],
      });

      if (!response.data.messages) {
        return [];
      }

      const messages = await Promise.all(
        response.data.messages.map(async (msg) => {
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'full',
          });
          return this.parseMessage(fullMessage.data);
        })
      );

      return messages;
    } catch (error) {
      logger.error('Error getting messages:', error);
      throw new Error('Failed to fetch messages');
    }
  }

  async listMessages(accessToken: string, maxResults: number = 10, query: string = 'is:unread') {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: query,
      });

      return response.data.messages || [];
    } catch (error) {
      logger.error('Error listing messages:', error);
      return [];
    }
  }

  async getMessage(accessToken: string, messageId: string) {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      return this.parseMessage(response.data);
    } catch (error) {
      logger.error('Error getting message:', error);
      throw new Error('Failed to fetch message');
    }
  }

  async getHistory(accessToken: string, startHistoryId: string) {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      const response = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
        labelId: 'INBOX',
      });

      return response.data;
    } catch (error) {
      logger.error('Error getting history:', error);
      throw new Error('Failed to fetch history');
    }
  }

  async modifyMessage(
    accessToken: string,
    messageId: string,
    addLabelIds?: string[],
    removeLabelIds?: string[]
  ) {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds,
          removeLabelIds,
        },
      });
    } catch (error) {
      logger.error('Error modifying message:', error);
      throw new Error('Failed to modify message');
    }
  }

  async markAsRead(accessToken: string, messageId: string) {
    await this.modifyMessage(accessToken, messageId, undefined, ['UNREAD']);
  }

  private parseMessage(message: any) {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const subject = getHeader('Subject');
    const from = getHeader('From');
    const to = getHeader('To').split(',').map((email: string) => email.trim());
    const date = getHeader('Date');
    const messageId = getHeader('Message-ID');

    // Extract body
    let body = '';
    if (message.payload?.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    } else if (message.payload?.parts) {
      const textPart = message.payload.parts.find(
        (part: any) => part.mimeType === 'text/plain' || part.mimeType === 'text/html'
      );
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

  private extractLinks(body: string): string[] {
    const urlRegex = /(https?:\/\/[^\s<>"]+)/gi;
    const matches = body.match(urlRegex);
    return matches || [];
  }

  async sendReply(
    accessToken: string,
    threadId: string,
    toEmail: string,
    subject: string,
    body: string
  ) {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

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

      logger.info(`Confirmation email sent to ${toEmail}`, {
        messageId: response.data.id,
        threadId,
      });

      return response.data;
    } catch (error) {
      logger.error('Error sending reply email:', error);
      throw new Error('Failed to send reply email');
    }
  }
}

export const gmailService = new GmailService();
