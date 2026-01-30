export declare class EmailPoller {
    private pollingIntervals;
    /**
     * Start polling for new emails for an email account
     */
    startPolling(emailAccountId: string, intervalMs?: number): void;
    /**
     * Stop polling for an email account
     */
    stopPolling(emailAccountId: string): void;
    /**
     * Poll a single email account for new messages
     */
    private pollEmailAccount;
    /**
     * Process a single Gmail message
     */
    private processMessage;
    /**
     * Parse Gmail message into EmailData format
     * @deprecated Use inline parsing instead - kept for reference
     */
    private _parseEmailData;
    /**
     * Start polling for all active email accounts
     */
    startPollingAll(): Promise<void>;
    /**
     * Stop polling for all email accounts
     */
    stopPollingAll(): void;
}
export declare const emailPoller: EmailPoller;
//# sourceMappingURL=emailPoller.d.ts.map