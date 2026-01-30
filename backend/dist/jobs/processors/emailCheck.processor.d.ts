import { Job } from 'bull';
interface EmailCheckJob {
    emailAccountId: string;
}
export declare function processEmailCheck(job: Job<EmailCheckJob>): Promise<{
    processed: number;
    skipped: number;
    error?: undefined;
    total?: undefined;
} | {
    error: string;
    processed?: undefined;
    skipped?: undefined;
    total?: undefined;
} | {
    processed: number;
    skipped: number;
    total: number;
    error?: undefined;
}>;
export {};
//# sourceMappingURL=emailCheck.processor.d.ts.map