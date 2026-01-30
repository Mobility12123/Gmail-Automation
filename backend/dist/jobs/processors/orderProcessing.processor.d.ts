import { Job } from 'bull';
interface OrderProcessingJob {
    emailAccountId: string;
    messageId: string;
}
export declare function processOrder(job: Job<OrderProcessingJob>): Promise<{
    success: boolean;
    error: string;
    message?: undefined;
    processingTime?: undefined;
    statusCode?: undefined;
    retryCount?: undefined;
} | {
    success: boolean;
    message: string;
    error?: undefined;
    processingTime?: undefined;
    statusCode?: undefined;
    retryCount?: undefined;
} | {
    success: boolean;
    processingTime: number;
    statusCode: number | undefined;
    error?: undefined;
    message?: undefined;
    retryCount?: undefined;
} | {
    success: boolean;
    error: string | undefined;
    retryCount: number;
    message?: undefined;
    processingTime?: undefined;
    statusCode?: undefined;
}>;
export {};
//# sourceMappingURL=orderProcessing.processor.d.ts.map