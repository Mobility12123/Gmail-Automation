"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ruleEngine = exports.RuleEngine = void 0;
const index_1 = require("../index");
const gmail_service_1 = require("./gmail.service");
const logger_1 = require("../utils/logger");
class RuleEngine {
    async processEmail(emailData) {
        try {
            const { emailAccountId, messageId, threadId, subject, from, to, receivedAt } = emailData;
            // Get email account with access token
            const emailAccount = await index_1.prisma.emailAccount.findUnique({
                where: { id: emailAccountId },
            });
            if (!emailAccount) {
                logger_1.logger.error(`Email account not found: ${emailAccountId}`);
                return;
            }
            // Get all active rules for this account, sorted by priority
            const rules = await index_1.prisma.rule.findMany({
                where: {
                    emailAccountId,
                    isActive: true,
                },
                orderBy: { priority: 'asc' },
            });
            let matchedRule = null;
            // Match against rules
            for (const rule of rules) {
                if (this.matchesRule(emailData, rule)) {
                    matchedRule = rule;
                    logger_1.logger.info(`Rule matched: "${rule.name}" for email from ${from}`);
                    break; // Use first matching rule
                }
            }
            // Execute rule action
            if (matchedRule) {
                await this.executeRuleAction(matchedRule, emailData, emailAccount);
                // Update rule statistics
                await index_1.prisma.rule.update({
                    where: { id: matchedRule.id },
                    data: {
                        matchCount: { increment: 1 },
                        successCount: { increment: 1 },
                        lastMatched: new Date(),
                    },
                });
            }
            // Save processed email (upsert to handle race conditions)
            await index_1.prisma.processedEmail.upsert({
                where: {
                    emailAccountId_messageId: {
                        emailAccountId,
                        messageId,
                    },
                },
                create: {
                    emailAccountId,
                    ruleId: matchedRule?.id || null,
                    messageId,
                    threadId,
                    subject,
                    from,
                    to,
                    receivedAt,
                    status: matchedRule ? 'ACCEPTED' : 'PENDING',
                },
                update: {
                    ruleId: matchedRule?.id || null,
                    status: matchedRule ? 'ACCEPTED' : 'PENDING',
                },
            });
            logger_1.logger.info(`Email processed: ${subject} (${messageId})`);
        }
        catch (error) {
            logger_1.logger.error('Error processing email:', error);
        }
    }
    matchesRule(emailData, rule) {
        const conditions = rule.conditions;
        logger_1.logger.debug(`Checking rule: "${rule.name}" for email: "${emailData.subject}"`);
        if (!conditions || (typeof conditions === 'object' && Object.keys(conditions).length === 0)) {
            logger_1.logger.debug(`Rule "${rule.name}" has no conditions`);
            return false;
        }
        // Handle case where conditions might be a string
        let parsedConditions = conditions;
        if (typeof conditions === 'string') {
            try {
                parsedConditions = JSON.parse(conditions);
            }
            catch (e) {
                logger_1.logger.error(`Failed to parse conditions JSON for rule "${rule.name}":`, e);
                return false;
            }
        }
        const checks = [];
        // Check subject
        if (parsedConditions.matchSubject) {
            const matches = emailData.subject.toLowerCase().includes(parsedConditions.matchSubject.toLowerCase());
            checks.push({ condition: 'matchSubject', result: matches });
        }
        // Check from
        if (parsedConditions.matchFrom) {
            const matches = emailData.from.toLowerCase().includes(parsedConditions.matchFrom.toLowerCase());
            checks.push({ condition: 'matchFrom', result: matches });
        }
        // Check body (if available)
        if (parsedConditions.matchBody && emailData.bodyPreview) {
            const matches = emailData.bodyPreview.toLowerCase().includes(parsedConditions.matchBody.toLowerCase());
            checks.push({ condition: 'matchBody', result: matches });
        }
        // If no conditions checked, don't match
        if (checks.length === 0) {
            logger_1.logger.debug(`Rule "${rule.name}" has no conditions defined`);
            return false;
        }
        // All checks must pass
        const finalResult = checks.every((check) => check.result === true);
        logger_1.logger.debug(`Rule "${rule.name}" match result: ${finalResult}`);
        return finalResult;
    }
    async executeRuleAction(rule, emailData, emailAccount) {
        try {
            switch (rule.action) {
                case 'ACCEPT':
                    logger_1.logger.info(`Action ACCEPT: ${emailData.subject}`);
                    break;
                case 'REJECT':
                    logger_1.logger.info(`Action REJECT: ${emailData.subject}`);
                    break;
                case 'FORWARD':
                    logger_1.logger.info(`Action FORWARD: ${emailData.subject}`);
                    break;
                case 'SEND_CONFIRMATION':
                    await this.sendConfirmation(rule, emailData, emailAccount);
                    break;
                default:
                    logger_1.logger.warn(`Unknown action: ${rule.action}`);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error executing rule action: ${rule.action}`, error);
            // Update failure count
            await index_1.prisma.rule.update({
                where: { id: rule.id },
                data: { failureCount: { increment: 1 } },
            });
        }
    }
    async sendConfirmation(rule, emailData, emailAccount) {
        try {
            // Get customer email from the "from" field
            const customerEmail = this.extractEmailAddress(emailData.from);
            const customerName = this.extractCustomerName(emailData.from);
            // Extract order details from email
            const orderDetails = this.extractOrderDetails(emailData.subject, emailData.bodyPreview || '');
            // Build dynamic confirmation email
            const confirmationSubject = this.replaceTemplateVariables(rule.confirmationSubject || 'Order Confirmation - #{{orderNumber}}', orderDetails, customerName, emailData);
            const body = this.replaceTemplateVariables(rule.confirmationBody || this.getDefaultConfirmationTemplate(), orderDetails, customerName, emailData);
            // Send reply email with custom subject
            await gmail_service_1.gmailService.sendReply(emailAccount.accessToken, emailData.threadId, customerEmail, confirmationSubject, body);
            logger_1.logger.info(`Confirmation sent to ${customerEmail} for order: ${orderDetails.orderNumber || 'N/A'}`);
        }
        catch (error) {
            logger_1.logger.error('Error sending confirmation:', error);
            throw error;
        }
    }
    extractOrderDetails(subject, body) {
        const fullText = `${subject} ${body}`;
        // Extract order number (various formats)
        const orderPatterns = [
            /order\s*#?\s*:?\s*([A-Z0-9-]+)/i,
            /order\s*(?:number|no|id)\s*:?\s*([A-Z0-9-]+)/i,
            /#([A-Z0-9-]{4,})/i,
            /confirmation\s*#?\s*:?\s*([A-Z0-9-]+)/i,
        ];
        let orderNumber = '';
        for (const pattern of orderPatterns) {
            const match = fullText.match(pattern);
            if (match) {
                orderNumber = match[1];
                break;
            }
        }
        // Extract price/amount
        const pricePatterns = [
            /\$\s*([\d,]+\.?\d*)/,
            /total\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
            /amount\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
            /price\s*:?\s*\$?\s*([\d,]+\.?\d*)/i,
        ];
        let price = '';
        for (const pattern of pricePatterns) {
            const match = fullText.match(pattern);
            if (match) {
                price = `$${match[1]}`;
                break;
            }
        }
        // Extract product info
        const productPatterns = [
            /product\s*:?\s*(.+?)(?:\n|$|,|\|)/i,
            /item\s*:?\s*(.+?)(?:\n|$|,|\|)/i,
            /ordered\s*:?\s*(.+?)(?:\n|$|,|\|)/i,
        ];
        let product = '';
        for (const pattern of productPatterns) {
            const match = fullText.match(pattern);
            if (match) {
                product = match[1].trim().substring(0, 50);
                break;
            }
        }
        // Extract quantity
        const qtyMatch = fullText.match(/(?:qty|quantity)\s*:?\s*(\d+)/i) ||
            fullText.match(/(\d+)\s*(?:items?|pieces?|pcs)/i);
        const quantity = qtyMatch ? qtyMatch[1] : '';
        // Extract product ID/SKU
        const skuMatch = fullText.match(/(?:sku|product\s*id|item\s*id)\s*:?\s*([A-Z0-9-]+)/i);
        const productId = skuMatch ? skuMatch[1] : '';
        return {
            orderNumber: orderNumber || this.generateOrderRef(),
            price,
            product,
            quantity,
            productId,
            orderDate: new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
        };
    }
    replaceTemplateVariables(template, orderDetails, customerName, emailData) {
        return template
            .replace(/\{\{orderNumber\}\}/gi, orderDetails.orderNumber)
            .replace(/\{\{price\}\}/gi, orderDetails.price || 'See order details')
            .replace(/\{\{product\}\}/gi, orderDetails.product || 'Your items')
            .replace(/\{\{quantity\}\}/gi, orderDetails.quantity || '1')
            .replace(/\{\{productId\}\}/gi, orderDetails.productId || 'N/A')
            .replace(/\{\{orderDate\}\}/gi, orderDetails.orderDate)
            .replace(/\{\{customerName\}\}/gi, customerName)
            .replace(/\{\{customerEmail\}\}/gi, this.extractEmailAddress(emailData.from))
            .replace(/\{\{subject\}\}/gi, emailData.subject);
    }
    extractCustomerName(fromField) {
        // Extract name from "John Doe <john@example.com>" format
        const nameMatch = fromField.match(/^([^<]+)</);
        if (nameMatch) {
            return nameMatch[1].trim().replace(/"/g, '');
        }
        // If no name, use part before @ in email
        const emailMatch = fromField.match(/([a-zA-Z0-9._-]+)@/);
        if (emailMatch) {
            return emailMatch[1].charAt(0).toUpperCase() + emailMatch[1].slice(1);
        }
        return 'Valued Customer';
    }
    generateOrderRef() {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `ORD-${timestamp}-${random}`;
    }
    getDefaultConfirmationTemplate() {
        return `Hi {{customerName}},

🎉 Great news! Your order has been confirmed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 ORDER DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Order Number: #{{orderNumber}}
Order Date: {{orderDate}}
Product: {{product}}
Quantity: {{quantity}}
Total Amount: {{price}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ What's Next?
• Your order is being processed
• You'll receive shipping updates via email
• Expected delivery: 3-5 business days

📞 Need Help?
Simply reply to this email and we'll get back to you within 24 hours.

Thank you for shopping with us!

Best regards,
The Store Team

---
This is an automated confirmation. Your order #{{orderNumber}} has been received.`;
    }
    extractEmailAddress(emailString) {
        // Extract email from format like "John Doe <john@example.com>" or just "john@example.com"
        const emailMatch = emailString.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
        return emailMatch ? emailMatch[1] : emailString;
    }
}
exports.RuleEngine = RuleEngine;
exports.ruleEngine = new RuleEngine();
//# sourceMappingURL=ruleEngine.js.map