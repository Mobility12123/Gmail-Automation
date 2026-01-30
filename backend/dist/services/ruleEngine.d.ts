export interface ProcessedEmailData {
    emailAccountId: string;
    messageId: string;
    threadId: string;
    subject: string;
    from: string;
    to: string[];
    receivedAt: Date;
    bodyPreview?: string;
}
export declare class RuleEngine {
    processEmail(emailData: ProcessedEmailData): Promise<void>;
    private matchesRule;
    private executeRuleAction;
    private sendConfirmation;
    private extractOrderDetails;
    private replaceTemplateVariables;
    private extractCustomerName;
    private generateOrderRef;
    private getDefaultConfirmationTemplate;
    private extractEmailAddress;
}
export declare const ruleEngine: RuleEngine;
//# sourceMappingURL=ruleEngine.d.ts.map