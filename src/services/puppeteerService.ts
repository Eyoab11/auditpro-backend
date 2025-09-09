// src/services/puppeteerService.ts
import puppeteer, { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import {
  RawAuditData,
  DetectedScript,
  InjectedTag,
  NetworkRequest,
  PerformanceMetrics
} from '../types';

export class PuppeteerService {
  private static readonly TRACKING_DOMAINS = [
    'googletagmanager.com',
    'google-analytics.com',
    'facebook.net',
    'linkedin.com',
    'tiktok.com',
    'twitter.com',
    'pinterest.com',
    'doubleclick.net',
    'hotjar.com',
    'segment.com',
    'mixpanel.com',
    'amplitude.com'
  ];

  static async performAudit(url: string, jobId: string): Promise<RawAuditData> {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      console.log(`🚀 Starting audit for ${url} (Job ID: ${jobId})`);

      // Use @sparticuz/chromium for launching browser
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });

      page = await browser.newPage();

      // Set user agent to avoid bot detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      // Initialize data collection
      const detectedScripts: DetectedScript[] = [];
      const networkRequests: NetworkRequest[] = [];
      const injectedTags: InjectedTag[] = [];

      // Monitor network requests
      page.on('request', (request) => {
        const requestUrl = request.url();
        const resourceType = request.resourceType();

        // Track relevant network requests
        if (this.isTrackingRequest(requestUrl) || ['script', 'xhr', 'fetch'].includes(resourceType)) {
          networkRequests.push({
            url: requestUrl,
            type: resourceType as any,
            initiator: request.frame()?.url() || url
          });
        }
      });

      // Navigate to the page
      console.log(`📄 Navigating to ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Wait a bit for dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract HTML content
      const html = await page.content();

      // Detect scripts in HTML
      await this.detectScripts(page, html, detectedScripts);

      // Detect injected tags
      await this.detectInjectedTags(page, html, injectedTags);

      // Capture performance metrics
      const performanceMetrics = await this.capturePerformanceMetrics(page);

      const auditData: RawAuditData = {
        url,
        timestamp: new Date().toISOString(),
        rawHtml: process.env.NODE_ENV === 'development' ? html : undefined, // Only store HTML in development
        detectedScripts,
        injectedTags,
        networkRequests,
        performanceMetrics
      };

      console.log(`✅ Audit completed for ${url} - Found ${injectedTags.length} tags, ${detectedScripts.length} scripts`);

      return auditData;

    } catch (error: any) {
      console.error(`❌ Audit failed for ${url}:`, error.message);
      if (error.message && error.message.includes('Could not find Chrome')) {
        console.error('ℹ️ Resolution: run "npx puppeteer browsers install chrome" or set PUPPETEER_EXECUTABLE_PATH to a valid Chromium binary path.');
      }

      // Return partial data with error information
      return {
        url,
        timestamp: new Date().toISOString(),
        detectedScripts: [],
        injectedTags: [],
        networkRequests: [],
        performanceMetrics: {
          loadTimeMs: 0,
          domContentLoadedMs: 0,
          navigationStart: Date.now(),
          loadEventEnd: Date.now(),
          domContentLoadedEventEnd: Date.now()
        },
  errors: [error.message]
      };
    } finally {
      // Always close browser
      if (page) {
        try {
          await page.close();
        } catch (e) {
          console.error('Error closing page:', e);
        }
      }
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          console.error('Error closing browser:', e);
        }
      }
    }
  }

  private static async detectScripts(page: Page, html: string, detectedScripts: DetectedScript[]): Promise<void> {
    try {
      // Extract script tags from HTML
      const scripts = await page.$$eval('script', (scripts) => {
        return scripts.map(script => ({
          src: script.src || '',
          type: script.src ? 'script' : 'inline',
          location: script.closest('head') ? 'head' : 'body',
          async: script.async,
          defer: script.defer,
          innerHTML: script.innerHTML
        }));
      });

      detectedScripts.push(...scripts as DetectedScript[]);
    } catch (error) {
      console.error('Error detecting scripts:', error);
    }
  }

  private static async detectInjectedTags(page: Page, html: string, injectedTags: InjectedTag[]): Promise<void> {
    try {
      // Check for Google Tag Manager
      const gtmMatches = html.match(/GTM-[A-Z0-9]+/g);
      if (gtmMatches) {
        gtmMatches.forEach(match => {
          if (!injectedTags.some(tag => tag.id === match)) {
            injectedTags.push({
              type: 'GTM',
              id: match,
              code: match,
              status: 'found'
            });
          }
        });
      }

      // Check for Google Analytics 4 (gtag)
      const ga4Matches = html.match(/G-[A-Z0-9]+/g);
      if (ga4Matches) {
        ga4Matches.forEach(match => {
          if (!injectedTags.some(tag => tag.measurementId === match)) {
            injectedTags.push({
              type: 'GA4',
              measurementId: match,
              code: match,
              status: 'found'
            });
          }
        });
      }

      // Check for Meta Pixel
      const metaMatches = html.match(/fbq\('init',\s*'([^']+)'/g);
      if (metaMatches) {
        metaMatches.forEach(match => {
          const pixelId = match.match(/'([^']+)'/)?.[1];
          if (pixelId && !injectedTags.some(tag => tag.pixelId === pixelId)) {
            injectedTags.push({
              type: 'MetaPixel',
              pixelId,
              code: pixelId,
              status: 'found'
            });
          }
        });
      }

      // Check for LinkedIn Insight Tag
      const linkedinMatches = html.match(/lntrck\('init',\s*'([^']+)'/g) || html.match(/_linkedin_partner_id\s*=\s*"([^"]+)"/g);
      if (linkedinMatches) {
        linkedinMatches.forEach(match => {
          const partnerId = match.match(/["']([^"']+)["']/)?.[1];
          if (partnerId && !injectedTags.some(tag => tag.id === partnerId)) {
            injectedTags.push({
              type: 'LinkedIn',
              id: partnerId,
              code: partnerId,
              status: 'found'
            });
          }
        });
      }

      // Check for TikTok Pixel
      const tiktokMatches = html.match(/ttq\.load\('([^']+)'/g);
      if (tiktokMatches) {
        tiktokMatches.forEach(match => {
          const pixelId = match.match(/'([^']+)'/)?.[1];
          if (pixelId && !injectedTags.some(tag => tag.id === pixelId)) {
            injectedTags.push({
              type: 'TikTok',
              id: pixelId,
              code: pixelId,
              status: 'found'
            });
          }
        });
      }

      // Check for Twitter Pixel
      const twitterMatches = html.match(/twq\('init',\s*'([^']+)'/g);
      if (twitterMatches) {
        twitterMatches.forEach(match => {
          const pixelId = match.match(/'([^']+)'/)?.[1];
          if (pixelId && !injectedTags.some(tag => tag.id === pixelId)) {
            injectedTags.push({
              type: 'Twitter',
              id: pixelId,
              code: pixelId,
              status: 'found'
            });
          }
        });
      }

      // Check for Pinterest Tag
      const pinterestMatches = html.match(/pintrk\('load',\s*'([^']+)'/g);
      if (pinterestMatches) {
        pinterestMatches.forEach(match => {
          const tagId = match.match(/'([^']+)'/)?.[1];
          if (tagId && !injectedTags.some(tag => tag.id === tagId)) {
            injectedTags.push({
              type: 'Pinterest',
              id: tagId,
              code: tagId,
              status: 'found'
            });
          }
        });
      }

    } catch (error) {
      console.error('Error detecting injected tags:', error);
    }
  }

  private static async capturePerformanceMetrics(page: Page): Promise<PerformanceMetrics> {
    try {
      const performanceData = await page.evaluate(() => {
        const perf = performance.getEntriesByType('navigation' as any)[0] as any;
        const paintEntries = performance.getEntriesByType('paint' as any);
        const lcpEntry = performance.getEntriesByType('largest-contentful-paint' as any)[0];
        const clsEntries = performance.getEntriesByType('layout-shift' as any);

        return {
          navigationStart: perf.startTime,
          loadEventEnd: perf.loadEventEnd,
          domContentLoadedEventEnd: perf.domContentLoadedEventEnd,
          firstContentfulPaint: paintEntries.find((entry: any) => entry.name === 'first-contentful-paint')?.startTime,
          largestContentfulPaint: lcpEntry?.startTime,
          cumulativeLayoutShift: clsEntries.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0)
        };
      });

      return {
        loadTimeMs: performanceData.loadEventEnd - performanceData.navigationStart,
        domContentLoadedMs: performanceData.domContentLoadedEventEnd - performanceData.navigationStart,
        firstContentfulPaintMs: performanceData.firstContentfulPaint,
        largestContentfulPaintMs: performanceData.largestContentfulPaint,
        cumulativeLayoutShift: performanceData.cumulativeLayoutShift,
        navigationStart: performanceData.navigationStart,
        loadEventEnd: performanceData.loadEventEnd,
        domContentLoadedEventEnd: performanceData.domContentLoadedEventEnd
      };
    } catch (error) {
      console.error('Error capturing performance metrics:', error);
      // Return basic metrics
      return {
        loadTimeMs: 0,
        domContentLoadedMs: 0,
        navigationStart: Date.now(),
        loadEventEnd: Date.now(),
        domContentLoadedEventEnd: Date.now()
      };
    }
  }

  private static isTrackingRequest(url: string): boolean {
    return this.TRACKING_DOMAINS.some(domain => url.includes(domain));
  }
}
