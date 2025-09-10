"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PuppeteerService = void 0;
// src/services/puppeteerService.ts
const puppeteer_core_1 = __importDefault(require("puppeteer-core"));
const chromium_1 = __importDefault(require("@sparticuz/chromium"));
class PuppeteerService {
    static async performAudit(url, jobId) {
        let browser = null;
        let page = null;
        try {
            console.log(`🚀 Starting audit for ${url} (Job ID: ${jobId})`);
            // Use @sparticuz/chromium for launching browser
            browser = await puppeteer_core_1.default.launch({
                args: chromium_1.default.args,
                defaultViewport: chromium_1.default.defaultViewport,
                executablePath: await chromium_1.default.executablePath(),
                headless: chromium_1.default.headless,
                ignoreHTTPSErrors: true,
            });
            page = await browser.newPage();
            // Reduce memory footprint
            await page.setCacheEnabled(false);
            // Set user agent to avoid bot detection
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            // Initialize data collection
            const detectedScripts = [];
            const networkRequests = [];
            const injectedTags = [];
            // Intercept requests to skip heavy assets and cap memory use
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                try {
                    const requestUrl = request.url();
                    const resourceType = request.resourceType();
                    // Abort heavy, non-essential assets to save memory/CPU
                    if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
                        request.abort();
                    }
                    else {
                        request.continue();
                    }
                    // Track relevant network requests (cap to 200 to prevent large arrays)
                    if ((this.isTrackingRequest(requestUrl) || ['script', 'xhr', 'fetch'].includes(resourceType)) &&
                        networkRequests.length < 200) {
                        networkRequests.push({
                            url: requestUrl,
                            type: resourceType,
                            initiator: request.frame()?.url() || url
                        });
                    }
                }
                catch {
                    // best-effort; ignore
                }
            });
            // Navigate to the page with graceful fallback
            console.log(`📄 Navigating to ${url}`);
            try {
                await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
            }
            catch (navErr) {
                if (navErr?.message?.includes('Navigation timeout')) {
                    console.warn(`⏱️ networkidle0 timeout for ${url}. Retrying with 'domcontentloaded'.`);
                    try {
                        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    }
                    catch (secondErr) {
                        throw secondErr; // propagate second failure
                    }
                }
                else {
                    throw navErr; // non-timeout error (e.g., DNS) propagate directly
                }
            }
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
            const auditData = {
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
        }
        catch (error) {
            console.error(`❌ Audit failed for ${url}:`, error.message);
            if (error.message && error.message.includes('Could not find Chrome')) {
                console.error('ℹ️ Resolution: run "npx puppeteer browsers install chrome" or set PUPPETEER_EXECUTABLE_PATH to a valid Chromium binary path.');
            }
            let classifiedMessage = error.message || 'Unknown error';
            if (/ERR_NAME_NOT_RESOLVED/i.test(classifiedMessage)) {
                classifiedMessage = 'DNS resolution failed (host not found)';
            }
            else if (/Navigation timeout/i.test(classifiedMessage)) {
                classifiedMessage = 'Navigation timeout (page took too long to load)';
            }
            else if (/net::ERR_CONNECTION_REFUSED/i.test(classifiedMessage)) {
                classifiedMessage = 'Connection refused by host';
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
                errors: [classifiedMessage]
            };
        }
        finally {
            // Always close browser
            if (page) {
                try {
                    await page.close();
                }
                catch (e) {
                    console.error('Error closing page:', e);
                }
            }
            if (browser) {
                try {
                    await browser.close();
                }
                catch (e) {
                    console.error('Error closing browser:', e);
                }
            }
        }
    }
    static async detectScripts(page, html, detectedScripts) {
        try {
            // Extract script tags from HTML
            const scripts = await page.$$eval('script', (scripts) => {
                return scripts.map(script => ({
                    src: script.src || '',
                    type: script.src ? 'script' : 'inline',
                    location: script.closest('head') ? 'head' : 'body',
                    async: script.async,
                    defer: script.defer
                    // Intentionally omit innerHTML to avoid huge payloads
                }));
            });
            detectedScripts.push(...scripts);
        }
        catch (error) {
            console.error('Error detecting scripts:', error);
        }
    }
    static async detectInjectedTags(page, html, injectedTags) {
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
        }
        catch (error) {
            console.error('Error detecting injected tags:', error);
        }
    }
    static async capturePerformanceMetrics(page) {
        try {
            const performanceData = await page.evaluate(() => {
                const perf = performance.getEntriesByType('navigation')[0];
                const paintEntries = performance.getEntriesByType('paint');
                const lcpEntry = performance.getEntriesByType('largest-contentful-paint')[0];
                const clsEntries = performance.getEntriesByType('layout-shift');
                return {
                    navigationStart: perf.startTime,
                    loadEventEnd: perf.loadEventEnd,
                    domContentLoadedEventEnd: perf.domContentLoadedEventEnd,
                    firstContentfulPaint: paintEntries.find((entry) => entry.name === 'first-contentful-paint')?.startTime,
                    largestContentfulPaint: lcpEntry?.startTime,
                    cumulativeLayoutShift: clsEntries.reduce((sum, entry) => sum + (entry.value || 0), 0)
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
        }
        catch (error) {
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
    static isTrackingRequest(url) {
        return this.TRACKING_DOMAINS.some(domain => url.includes(domain));
    }
}
exports.PuppeteerService = PuppeteerService;
PuppeteerService.TRACKING_DOMAINS = [
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
//# sourceMappingURL=puppeteerService.js.map