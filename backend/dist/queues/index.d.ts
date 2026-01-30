declare let emailCheckQueue: any;
declare let orderProcessingQueue: any;
declare let notificationQueue: any;
export { emailCheckQueue, orderProcessingQueue, notificationQueue };
export declare function initializeQueues(): Promise<void>;
export declare function scheduleEmailCheck(emailAccountId: string): Promise<void>;
export declare function scheduleOrderProcessing(emailAccountId: string, messageId: string): Promise<void>;
//# sourceMappingURL=index.d.ts.map