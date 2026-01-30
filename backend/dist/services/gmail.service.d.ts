export declare class GmailService {
    private oauth2Client;
    constructor();
    getAuthUrl(): string;
    getTokensFromCode(code: string): Promise<import("google-auth-library").Credentials>;
    refreshAccessToken(refreshToken: string): Promise<import("google-auth-library").Credentials>;
    getUserEmail(accessToken: string): Promise<string>;
    watchMailbox(accessToken: string, topicName?: string): Promise<{
        historyId: string | null | undefined;
        expiration: string | null | undefined;
    } | null>;
    getMessages(accessToken: string, maxResults?: number, query?: string): Promise<{
        id: any;
        threadId: any;
        messageId: any;
        subject: any;
        from: any;
        to: any;
        date: Date;
        body: string;
        bodyPreview: string;
        links: string[];
        labels: any;
        snippet: any;
    }[]>;
    listMessages(accessToken: string, maxResults?: number, query?: string): Promise<import("googleapis").gmail_v1.Schema$Message[]>;
    getMessage(accessToken: string, messageId: string): Promise<{
        id: any;
        threadId: any;
        messageId: any;
        subject: any;
        from: any;
        to: any;
        date: Date;
        body: string;
        bodyPreview: string;
        links: string[];
        labels: any;
        snippet: any;
    }>;
    getHistory(accessToken: string, startHistoryId: string): Promise<import("googleapis").gmail_v1.Schema$ListHistoryResponse>;
    modifyMessage(accessToken: string, messageId: string, addLabelIds?: string[], removeLabelIds?: string[]): Promise<void>;
    markAsRead(accessToken: string, messageId: string): Promise<void>;
    private parseMessage;
    private extractLinks;
    sendReply(accessToken: string, threadId: string, toEmail: string, subject: string, body: string): Promise<import("googleapis").gmail_v1.Schema$Message>;
}
export declare const gmailService: GmailService;
//# sourceMappingURL=gmail.service.d.ts.map