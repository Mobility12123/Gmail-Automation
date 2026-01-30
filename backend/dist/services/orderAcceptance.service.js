"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderAcceptanceService = exports.OrderAcceptanceService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
class OrderAcceptanceService {
    timeout = 10000; // 10 seconds
    maxRetries = 3;
    retryDelay = 2000; // 2 seconds
    /**
     * Accept an order by following the acceptance link
     */
    async acceptOrder(acceptLink, retryCount = 0) {
        const startTime = Date.now();
        try {
            logger_1.logger.info(`Attempting to accept order: ${acceptLink}`);
            const response = await axios_1.default.get(acceptLink, {
                timeout: this.timeout,
                maxRedirects: 5,
                validateStatus: (status) => status >= 200 && status < 400,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });
            const responseTime = Date.now() - startTime;
            logger_1.logger.info(`Order accepted successfully in ${responseTime}ms: ${acceptLink}`);
            return {
                success: true,
                statusCode: response.status,
                responseTime,
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            logger_1.logger.error(`Error accepting order (attempt ${retryCount + 1}):`, {
                link: acceptLink,
                error: error.message,
                responseTime,
            });
            // Retry logic
            if (retryCount < this.maxRetries) {
                logger_1.logger.info(`Retrying order acceptance in ${this.retryDelay}ms...`);
                await this.delay(this.retryDelay);
                return this.acceptOrder(acceptLink, retryCount + 1);
            }
            return {
                success: false,
                error: error.message,
                statusCode: error.response?.status,
                responseTime,
            };
        }
    }
    /**
     * Accept order with POST request (for forms)
     */
    async acceptOrderWithPost(acceptLink, formData, retryCount = 0) {
        const startTime = Date.now();
        try {
            logger_1.logger.info(`Attempting to accept order via POST: ${acceptLink}`);
            const response = await axios_1.default.post(acceptLink, formData, {
                timeout: this.timeout,
                maxRedirects: 5,
                validateStatus: (status) => status >= 200 && status < 400,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            const responseTime = Date.now() - startTime;
            logger_1.logger.info(`Order accepted successfully via POST in ${responseTime}ms`);
            return {
                success: true,
                statusCode: response.status,
                responseTime,
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            logger_1.logger.error(`Error accepting order via POST (attempt ${retryCount + 1}):`, {
                link: acceptLink,
                error: error.message,
                responseTime,
            });
            // Retry logic
            if (retryCount < this.maxRetries) {
                logger_1.logger.info(`Retrying order acceptance in ${this.retryDelay}ms...`);
                await this.delay(this.retryDelay);
                return this.acceptOrderWithPost(acceptLink, formData, retryCount + 1);
            }
            return {
                success: false,
                error: error.message,
                statusCode: error.response?.status,
                responseTime,
            };
        }
    }
    /**
     * Validate if a link is accessible
     */
    async validateLink(link) {
        try {
            const response = await axios_1.default.head(link, {
                timeout: 5000,
                maxRedirects: 5,
                validateStatus: (status) => status >= 200 && status < 400,
            });
            return response.status >= 200 && response.status < 400;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Check if link requires authentication
     */
    async requiresAuth(link) {
        try {
            const response = await axios_1.default.head(link, {
                timeout: 5000,
                maxRedirects: 0,
                validateStatus: () => true,
            });
            return response.status === 401 || response.status === 403;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Extract form action and fields from HTML
     */
    extractFormDetails(html) {
        try {
            // Simple form parsing - for production, use a proper HTML parser like cheerio
            const formMatch = html.match(/<form[^>]*action=["']([^"']+)["'][^>]*>/i);
            const action = formMatch ? formMatch[1] : null;
            const fields = {};
            const inputMatches = html.matchAll(/<input[^>]*name=["']([^"']+)["'][^>]*value=["']([^"']+)["'][^>]*>/gi);
            for (const match of inputMatches) {
                fields[match[1]] = match[2];
            }
            return { action, fields };
        }
        catch (error) {
            logger_1.logger.error('Error extracting form details:', error);
            return null;
        }
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.OrderAcceptanceService = OrderAcceptanceService;
exports.orderAcceptanceService = new OrderAcceptanceService();
//# sourceMappingURL=orderAcceptance.service.js.map