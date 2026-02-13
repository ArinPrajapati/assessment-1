/**
 * Browser lifecycle management
 */

import { Browser, chromium, Page } from 'playwright';
import { Logger } from '../utils/logger';
import * as fs from 'fs';

export class BrowserManager {
  private browser: Browser | null = null;
  private logger: Logger;
  private headless: boolean;
  private screenshotDir: string;

  constructor(logger: Logger, headless: boolean, screenshotDir: string) {
    this.logger = logger;
    this.headless = headless;
    this.screenshotDir = screenshotDir;

    // Ensure screenshot directory exists
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  async launch(): Promise<Browser> {
    const startTime = Date.now();

    this.logger.info(`Launching browser (headless: ${this.headless})`);

    this.browser = await chromium.launch({
      headless: this.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const duration = Date.now() - startTime;
    this.logger.perf('Browser launch', duration);

    return this.browser;
  }

  async createPage(): Promise<Page> {
    if (!this.browser) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const page = await this.browser.newPage();

    // Set reasonable viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    return page;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.logger.debug('Browser closed');
      this.browser = null;
    } else {
      this.logger.warn('Browser close called but browser was not launched');
    }
  }

  // for debugging if needed in future 
  getBrowser(): Browser {
    if (!this.browser) {
      throw new Error('Browser not launched');
    }
    return this.browser;
  }
}
