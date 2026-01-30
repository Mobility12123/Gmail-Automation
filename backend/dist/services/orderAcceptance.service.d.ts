interface AcceptOrderResult {
    success: boolean;
    statusCode?: number;
    error?: string;
    responseTime: number;
}
export declare class OrderAcceptanceService {
    private readonly timeout;
    private readonly maxRetries;
    private readonly retryDelay;
    /**
     * Accept an order by following the acceptance link
     */
    acceptOrder(acceptLink: string, retryCount?: number): Promise<AcceptOrderResult>;
    /**
     * Accept order with POST request (for forms)
     */
    acceptOrderWithPost(acceptLink: string, formData?: Record<string, any>, retryCount?: number): Promise<AcceptOrderResult>;
    /**
     * Validate if a link is accessible
     */
    validateLink(link: string): Promise<boolean>;
    /**
     * Check if link requires authentication
     */
    requiresAuth(link: string): Promise<boolean>;
    /**
     * Extract form action and fields from HTML
     */
    extractFormDetails(html: string): {
        action: string | null;
        fields: Record<string, string>;
    } | null;
    private delay;
}
export declare const orderAcceptanceService: OrderAcceptanceService;
export {};
//# sourceMappingURL=orderAcceptance.service.d.ts.map