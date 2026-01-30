import axios from 'axios';
import { logger } from '../utils/logger';

interface AcceptOrderResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  responseTime: number;
}

export class OrderAcceptanceService {
  private readonly timeout = 10000; // 10 seconds
  private readonly maxRetries = 3;
  private readonly retryDelay = 2000; // 2 seconds

  /**
   * Accept an order by following the acceptance link
   */
  async acceptOrder(
    acceptLink: string,
    retryCount: number = 0
  ): Promise<AcceptOrderResult> {
    const startTime = Date.now();

    try {
      logger.info(`Attempting to accept order: ${acceptLink}`);

      const response = await axios.get(acceptLink, {
        timeout: this.timeout,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const responseTime = Date.now() - startTime;

      logger.info(`Order accepted successfully in ${responseTime}ms: ${acceptLink}`);

      return {
        success: true,
        statusCode: response.status,
        responseTime,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      logger.error(`Error accepting order (attempt ${retryCount + 1}):`, {
        link: acceptLink,
        error: error.message,
        responseTime,
      });

      // Retry logic
      if (retryCount < this.maxRetries) {
        logger.info(`Retrying order acceptance in ${this.retryDelay}ms...`);
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
  async acceptOrderWithPost(
    acceptLink: string,
    formData?: Record<string, any>,
    retryCount: number = 0
  ): Promise<AcceptOrderResult> {
    const startTime = Date.now();

    try {
      logger.info(`Attempting to accept order via POST: ${acceptLink}`);

      const response = await axios.post(acceptLink, formData, {
        timeout: this.timeout,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const responseTime = Date.now() - startTime;

      logger.info(`Order accepted successfully via POST in ${responseTime}ms`);

      return {
        success: true,
        statusCode: response.status,
        responseTime,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      logger.error(`Error accepting order via POST (attempt ${retryCount + 1}):`, {
        link: acceptLink,
        error: error.message,
        responseTime,
      });

      // Retry logic
      if (retryCount < this.maxRetries) {
        logger.info(`Retrying order acceptance in ${this.retryDelay}ms...`);
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
  async validateLink(link: string): Promise<boolean> {
    try {
      const response = await axios.head(link, {
        timeout: 5000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      return response.status >= 200 && response.status < 400;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if link requires authentication
   */
  async requiresAuth(link: string): Promise<boolean> {
    try {
      const response = await axios.head(link, {
        timeout: 5000,
        maxRedirects: 0,
        validateStatus: () => true,
      });

      return response.status === 401 || response.status === 403;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract form action and fields from HTML
   */
  extractFormDetails(html: string): {
    action: string | null;
    fields: Record<string, string>;
  } | null {
    try {
      // Simple form parsing - for production, use a proper HTML parser like cheerio
      const formMatch = html.match(/<form[^>]*action=["']([^"']+)["'][^>]*>/i);
      const action = formMatch ? formMatch[1] : null;

      const fields: Record<string, string> = {};
      const inputMatches = html.matchAll(
        /<input[^>]*name=["']([^"']+)["'][^>]*value=["']([^"']+)["'][^>]*>/gi
      );

      for (const match of inputMatches) {
        fields[match[1]] = match[2];
      }

      return { action, fields };
    } catch (error) {
      logger.error('Error extracting form details:', error);
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const orderAcceptanceService = new OrderAcceptanceService();
