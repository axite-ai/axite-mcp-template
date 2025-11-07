/**
 * Locale-aware formatting utilities
 *
 * Uses OpenAI metadata to format currency, dates, and times in the user's locale and timezone.
 * Based on the Intl API for internationalization.
 */

import type { OpenAIMetadata } from '../types';

/**
 * Formatter that adapts to user's locale and timezone from OpenAI metadata
 */
export class LocaleFormatter {
  private locale: string;
  private timezone: string;

  /**
   * Create a formatter from OpenAI metadata
   *
   * @param metadata - Optional OpenAI metadata from tool request
   * @param defaults - Optional default locale/timezone if metadata is missing
   */
  constructor(
    metadata?: OpenAIMetadata,
    defaults: { locale?: string; timezone?: string } = {}
  ) {
    this.locale = metadata?.['openai/locale'] || defaults.locale || 'en-US';
    this.timezone =
      metadata?.['openai/userLocation']?.timezone || defaults.timezone || 'UTC';
  }

  /**
   * Format a currency amount in the user's locale
   *
   * @param amount - The numerical amount
   * @param currency - ISO 4217 currency code (e.g., "USD", "EUR")
   * @returns Formatted currency string (e.g., "$1,234.56", "1.234,56 €")
   *
   * @example
   * formatter.formatCurrency(1234.56, 'USD')
   * // en-US: "$1,234.56"
   * // de-DE: "1.234,56 $"
   * // fr-FR: "1 234,56 $US"
   */
  formatCurrency(amount: number, currency: string = 'USD'): string {
    try {
      return new Intl.NumberFormat(this.locale, {
        style: 'currency',
        currency,
        // Show cents even for whole numbers
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      // Fallback if locale/currency combination is invalid
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
    }
  }

  /**
   * Format a date in the user's timezone with locale-specific formatting
   *
   * @param date - Date object or ISO string
   * @param style - Date style (short, medium, long, full)
   * @returns Formatted date string
   *
   * @example
   * formatter.formatDate(new Date('2024-01-15T10:30:00Z'))
   * // en-US, America/New_York: "Jan 15, 2024, 5:30 AM"
   * // fr-FR, Europe/Paris: "15 janv. 2024 à 11:30"
   */
  formatDate(
    date: Date | string,
    style: 'short' | 'medium' | 'long' | 'full' = 'medium'
  ): string {
    const d = typeof date === 'string' ? new Date(date) : date;

    try {
      return new Intl.DateTimeFormat(this.locale, {
        timeZone: this.timezone,
        dateStyle: style,
        timeStyle: 'short',
      }).format(d);
    } catch {
      // Fallback to UTC if timezone is invalid
      return new Intl.DateTimeFormat(this.locale, {
        dateStyle: style,
        timeStyle: 'short',
      }).format(d);
    }
  }

  /**
   * Format a date without time component
   *
   * @param date - Date object or ISO string
   * @returns Formatted date string
   *
   * @example
   * formatter.formatDateOnly(new Date('2024-01-15'))
   * // en-US: "Jan 15, 2024"
   * // de-DE: "15. Jan. 2024"
   */
  formatDateOnly(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;

    try {
      return new Intl.DateTimeFormat(this.locale, {
        timeZone: this.timezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(d);
    } catch {
      return new Intl.DateTimeFormat(this.locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(d);
    }
  }

  /**
   * Format a relative time ("2 hours ago", "in 3 days")
   *
   * @param date - Date object or ISO string to compare against now
   * @returns Relative time string
   *
   * @example
   * formatter.formatRelativeTime(new Date(Date.now() - 2 * 60 * 60 * 1000))
   * // en-US: "2 hours ago"
   * // es-ES: "hace 2 horas"
   * // fr-FR: "il y a 2 heures"
   */
  formatRelativeTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const rtf = new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' });

    const diffMs = d.getTime() - Date.now();
    const diffSeconds = Math.round(diffMs / 1000);
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    // Choose appropriate unit based on magnitude
    if (Math.abs(diffDays) >= 1) {
      return rtf.format(diffDays, 'day');
    } else if (Math.abs(diffHours) >= 1) {
      return rtf.format(diffHours, 'hour');
    } else if (Math.abs(diffMinutes) >= 1) {
      return rtf.format(diffMinutes, 'minute');
    } else {
      return rtf.format(diffSeconds, 'second');
    }
  }

  /**
   * Format a number with locale-specific separators
   *
   * @param value - The number to format
   * @param options - Optional Intl.NumberFormat options
   * @returns Formatted number string
   *
   * @example
   * formatter.formatNumber(1234567.89)
   * // en-US: "1,234,567.89"
   * // de-DE: "1.234.567,89"
   * // fr-FR: "1 234 567,89"
   */
  formatNumber(
    value: number,
    options: Intl.NumberFormatOptions = {}
  ): string {
    return new Intl.NumberFormat(this.locale, options).format(value);
  }

  /**
   * Get the user's locale
   */
  getLocale(): string {
    return this.locale;
  }

  /**
   * Get the user's timezone
   */
  getTimezone(): string {
    return this.timezone;
  }
}
