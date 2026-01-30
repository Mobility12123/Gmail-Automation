import { Rule, RuleOperator, RuleLogic } from '@prisma/client';
import { logger } from '../utils/logger';

interface RuleCondition {
  field: string; // 'from', 'to', 'subject', 'body', 'label'
  operator: RuleOperator;
  value: string;
}

interface EmailData {
  from: string;
  to: string[];
  subject: string;
  body: string;
  labels: string[];
  date: Date;
  [key: string]: any;
}

export class RuleMatchingService {
  /**
   * Check if an email matches the given rule
   */
  matchRule(email: EmailData, rule: Rule): boolean {
    if (!rule.isActive) {
      return false;
    }

    const conditions = rule.conditions as RuleCondition[];
    
    if (!Array.isArray(conditions) || conditions.length === 0) {
      return false;
    }

    const results = conditions.map(condition => 
      this.evaluateCondition(email, condition)
    );

    // Apply logic (AND or OR)
    if (rule.logic === RuleLogic.AND) {
      return results.every(result => result === true);
    } else {
      return results.some(result => result === true);
    }
  }

  /**
   * Find all matching rules for an email
   */
  findMatchingRules(email: EmailData, rules: Rule[]): Rule[] {
    const matchingRules = rules
      .filter(rule => this.matchRule(email, rule))
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    return matchingRules;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(email: EmailData, condition: RuleCondition): boolean {
    try {
      const fieldValue = this.getFieldValue(email, condition.field);
      const testValue = condition.value;

      switch (condition.operator) {
        case RuleOperator.EQUALS:
          return this.equals(fieldValue, testValue);

        case RuleOperator.NOT_EQUALS:
          return !this.equals(fieldValue, testValue);

        case RuleOperator.CONTAINS:
          return this.contains(fieldValue, testValue);

        case RuleOperator.NOT_CONTAINS:
          return !this.contains(fieldValue, testValue);

        case RuleOperator.STARTS_WITH:
          return this.startsWith(fieldValue, testValue);

        case RuleOperator.ENDS_WITH:
          return this.endsWith(fieldValue, testValue);

        case RuleOperator.REGEX:
          return this.matchesRegex(fieldValue, testValue);

        default:
          logger.warn(`Unknown operator: ${condition.operator}`);
          return false;
      }
    } catch (error) {
      logger.error('Error evaluating condition:', error);
      return false;
    }
  }

  /**
   * Get field value from email
   */
  private getFieldValue(email: EmailData, field: string): string {
    switch (field.toLowerCase()) {
      case 'from':
        return email.from.toLowerCase();

      case 'to':
        return email.to.join(',').toLowerCase();

      case 'subject':
        return email.subject.toLowerCase();

      case 'body':
        return email.body.toLowerCase();

      case 'label':
      case 'labels':
        return email.labels.join(',').toLowerCase();

      default:
        // Support custom fields
        return String(email[field] || '').toLowerCase();
    }
  }

  /**
   * Comparison operators
   */
  private equals(fieldValue: string, testValue: string): boolean {
    return fieldValue === testValue.toLowerCase();
  }

  private contains(fieldValue: string, testValue: string): boolean {
    return fieldValue.includes(testValue.toLowerCase());
  }

  private startsWith(fieldValue: string, testValue: string): boolean {
    return fieldValue.startsWith(testValue.toLowerCase());
  }

  private endsWith(fieldValue: string, testValue: string): boolean {
    return fieldValue.endsWith(testValue.toLowerCase());
  }

  private matchesRegex(fieldValue: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(fieldValue);
    } catch (error) {
      logger.error('Invalid regex pattern:', pattern);
      return false;
    }
  }

  /**
   * Extract order acceptance link from email
   */
  extractAcceptLink(email: EmailData, patterns?: string[]): string | null {
    // Default patterns for common order acceptance links
    const defaultPatterns = [
      /https?:\/\/[^\s]*accept[^\s]*/gi,
      /https?:\/\/[^\s]*confirm[^\s]*/gi,
      /https?:\/\/[^\s]*order[^\s]*/gi,
      /https?:\/\/[^\s]*claim[^\s]*/gi,
    ];

    const patternsToUse = patterns
      ? patterns.map(p => new RegExp(p, 'gi'))
      : defaultPatterns;

    for (const pattern of patternsToUse) {
      const matches = email.body.match(pattern);
      if (matches && matches.length > 0) {
        // Return the first match, cleaned up
        return matches[0].replace(/[>\s]+$/, '');
      }
    }

    return null;
  }

  /**
   * Validate rule conditions
   */
  validateConditions(conditions: any[]): boolean {
    if (!Array.isArray(conditions) || conditions.length === 0) {
      return false;
    }

    for (const condition of conditions) {
      if (!condition.field || !condition.operator || condition.value === undefined) {
        return false;
      }

      // Validate operator
      if (!Object.values(RuleOperator).includes(condition.operator)) {
        return false;
      }

      // Validate field
      const validFields = ['from', 'to', 'subject', 'body', 'label', 'labels'];
      if (!validFields.includes(condition.field.toLowerCase())) {
        // Allow custom fields but log a warning
        logger.warn(`Custom field used in rule: ${condition.field}`);
      }
    }

    return true;
  }
}

export const ruleMatchingService = new RuleMatchingService();
