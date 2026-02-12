import { Page } from 'playwright';
import { UserProfile, ApplicationResult } from '../types.js';
import { Logger } from '../utils/logger.js';
import { HumanBehavior } from './HumanBehavior.js';
import { findBestMatch, MatchableOption } from '../utils/matcher.js';

export abstract class BasePlatform {
  protected page: Page;
  protected profile: UserProfile;
  protected logger: Logger;
  protected humanBehavior: HumanBehavior;
  protected screenshotDir: string;
  protected platformName: string;

  constructor(
    page: Page,
    profile: UserProfile,
    logger: Logger,
    screenshotDir: string,
    platformName: string
  ) {
    this.page = page;
    this.profile = profile;
    this.logger = logger;
    this.humanBehavior = new HumanBehavior(page);
    this.screenshotDir = screenshotDir;
    this.platformName = platformName;
  }

  async run(): Promise<ApplicationResult> {
    const startTime = Date.now();
    this.logger.info(`Starting ${this.platformName} application...`);

    try {
      const confirmationId = await this.apply();

      const duration = Date.now() - startTime;
      this.logger.perf(`${this.platformName} application completed`, duration);

      return {
        success: true,
        confirmationId,
        durationMs: duration
      };
    } catch (error) {
      await this.screenshot('error');

      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(`${this.platformName} application failed: ${errorMessage}`, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: errorMessage,
        durationMs: duration
      };
    }
  }

  protected abstract apply(): Promise<string>;

  protected async screenshot(context: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${this.screenshotDir}/${this.platformName}-${context}-${timestamp}.png`;
      await this.page.screenshot({ path: filename, fullPage: true });
      this.logger.debug(`Screenshot saved: ${filename}`);
    } catch (error) {
      this.logger.warn(`Failed to take screenshot: ${error}`);
    }
  }

  protected async click(selector: string, options?: { timeout?: number }): Promise<void> {
    await this.retryWithBackoff(async () => {
      await this.page.waitForSelector(selector, {
        state: 'visible',
        timeout: options?.timeout || 10000
      });

      const locator = this.page.locator(selector);
      await this.humanBehavior.hoverBeforeClick(locator);
      await this.humanBehavior.clickWithOffset(locator);

      this.logger.debug(`Clicked: ${selector}`);
    }, `click ${selector}`);
  }

  protected async type(
    selector: string,
    text: string,
    options?: { clearFirst?: boolean; timeout?: number; fieldType?: 'text' | 'email' | 'phone' | 'date' | 'number' }
  ): Promise<void> {
    await this.retryWithBackoff(async () => {
      await this.page.waitForSelector(selector, {
        state: 'visible',
        timeout: options?.timeout || 10000
      });

      if (options?.clearFirst) {
        await this.page.fill(selector, '');
      }

      //handling for date fields  
      if (options?.fieldType === 'date') {
        await this.page.fill(selector, text);
        await this.humanBehavior.randomDelay();
      } else {
        await this.page.focus(selector);
        await this.humanBehavior.typeWithVariableSpeed(text, options?.fieldType);
      }

      this.logger.debug(`Typed into ${selector}: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`);
    }, `type into ${selector}`);
  }

  /**
   * Selects an option from a standard <select> dropdown using smart matching
   */
  protected async select(
    selector: string,
    targetValue: string,
    options?: { required?: boolean; timeout?: number }
  ): Promise<void> {
    await this.retryWithBackoff(async () => {
      const selectElement = await this.page.waitForSelector(selector, {
        state: 'visible',
        timeout: options?.timeout || 10000
      });

      if (!selectElement) {
        throw new Error(`Select element not found: ${selector}`);
      }

      // Extract options from the <select> element
      const domOptions = await selectElement.evaluate((el: Element) => {
        const selectEl = el as HTMLSelectElement;
        return Array.from(selectEl.options).map(opt => ({
          value: opt.value,
          text: opt.textContent?.trim() || '',
          disabled: opt.disabled
        }));
      });

      const matchableOptions: MatchableOption[] = domOptions.map(opt => ({
        value: opt.value,
        text: opt.text,
        disabled: opt.disabled
      }));

      const matchedValue = findBestMatch(targetValue, matchableOptions);

      if (!matchedValue) {
        throw new Error(`No match found for "${targetValue}" in ${selector}`);
      }

      await selectElement.selectOption(matchedValue);
      await this.humanBehavior.randomDelay();

      this.logger.debug(`Selected ${selector}: ${targetValue} -> ${matchedValue}`);
    }, `select ${selector}`);
  }

  protected async selectSmart(
    inputSelector: string,
    dropdownSelector: string,
    targetValue: string,
    options?: {
      timeout?: number;
      waitForSpinner?: string;
    }
  ): Promise<void> {
    await this.retryWithBackoff(async () => {
      await this.click(inputSelector);
      await this.humanBehavior.randomDelay();
      const timeout = options?.timeout || 15000;

      const searchTerm = targetValue.substring(0, Math.min(3, targetValue.length));
      await this.type(inputSelector, searchTerm, { clearFirst: true });

      await this.page.waitForSelector(dropdownSelector, {
        state: 'visible',
        timeout: timeout
      });

      if (options?.waitForSpinner) {
        try {
          await this.page.waitForSelector(options.waitForSpinner, { state: 'hidden', timeout: timeout });
        } catch {
          // Spinner not found or already hidden
        }
      }

      await this.humanBehavior.randomDelay();

      const domOptions = await this.page.$$eval(
        `${dropdownSelector} [role="option"], ${dropdownSelector} li, ${dropdownSelector} .option`,
        (elements) => elements.map(el => ({
          value: (el as HTMLElement).dataset.value || el.textContent?.trim() || '',
          text: el.textContent?.trim() || '',
          disabled: (el as HTMLElement).getAttribute('aria-disabled') === 'true'
        }))
      );

      const matchableOptions: MatchableOption[] = domOptions.map(opt => ({
        value: opt.value,
        text: opt.text,
        disabled: opt.disabled
      }));

      const matchedValue = findBestMatch(targetValue, matchableOptions);

      if (!matchedValue) {
        throw new Error(`No match found for "${targetValue}" in typeahead ${inputSelector}`);
      }

      const matchedOption = matchableOptions.find(o => o.value === matchedValue);
      const optionText = matchedOption?.text || matchedValue;
      const optionSelector = `${dropdownSelector} [role="option"]:has-text("${optionText}"), ${dropdownSelector} li:has-text("${optionText}")`;
      await this.click(optionSelector);

      this.logger.debug(`Selected typeahead ${inputSelector}: ${targetValue} -> ${matchedValue}`);
    }, `selectSmart ${inputSelector}`);
  }

  protected async uploadFile(selector: string, filePath: string): Promise<void> {
    await this.retryWithBackoff(async () => {
      await this.page.waitForSelector(selector, {
        timeout: 10000
      });

      await this.page.setInputFiles(selector, filePath);
      await this.humanBehavior.randomDelay();

      this.logger.debug(`Uploaded file to ${selector}: ${filePath}`);
    }, `uploadFile ${selector}`);
  }

  /**
   * Checks a checkbox or radio button using smart matching
   */
  protected async check(
    containerSelector: string,
    targetValue: string,
    options?: { required?: boolean }
  ): Promise<void> {
    await this.retryWithBackoff(async () => {
      // Extract all checkboxes/radios in the container
      const domOptions = await this.page.$$eval(
        `${containerSelector} input[type="checkbox"][value="${targetValue}"], ${containerSelector} input[type="radio"][value="${targetValue}"]`,
        (elements) => elements.map(el => {
          const input = el as HTMLInputElement;
          const label = input.labels?.[0]?.textContent?.trim() || '';
          return {
            value: input.value,
            text: label || input.value,
            disabled: input.disabled,
            selector: `input[value="${input.value}"]`
          };
        })
      );

      const matchableOptions: MatchableOption[] = domOptions.map(opt => ({
        value: opt.value,
        text: opt.text,
        disabled: opt.disabled
      }));

      const matchedValue = findBestMatch(targetValue, matchableOptions);

      if (!matchedValue) {
        throw new Error(`No match found for "${targetValue}" in ${containerSelector}`);
      }

      const inputSelector = `${containerSelector} input[value="${matchedValue}"]`;
      await this.click(inputSelector);

      this.logger.debug(`Checked ${containerSelector}: ${targetValue} -> ${matchedValue}`);
    }, `check ${containerSelector}`);
  }

  /**
   * Toggles a switch or checkbox to a specific state
   */
  protected async toggle(selector: string, targetState: boolean): Promise<void> {
    await this.retryWithBackoff(async () => {
      const element = await this.page.waitForSelector(selector, {
        state: 'visible',
        timeout: 10000
      });

      if (!element) {
        throw new Error(`Toggle element not found: ${selector}`);
      }

      // Check current state
      const currentState = await element.evaluate((el: Element) => {
        const input = el as HTMLInputElement;
        return input.checked || el.classList.contains('active') || el.getAttribute('aria-checked') === 'true';
      });

      // Only click if state needs to change
      if (currentState !== targetState) {
        await this.click(selector);
        this.logger.debug(`Toggled ${selector}: ${currentState} -> ${targetState}`);
      } else {
        this.logger.debug(`Toggle ${selector} already in desired state: ${targetState}`);
      }
    }, `toggle ${selector}`);
  }

  /**
   * Waits for a selector with optional state
   */
  protected async waitFor(
    selector: string,
    options?: { state?: 'attached' | 'visible' | 'hidden'; timeout?: number }
  ): Promise<void> {
    await this.page.waitForSelector(selector, {
      state: options?.state || 'visible',
      timeout: options?.timeout || 10000
    });
    this.logger.debug(`Waited for: ${selector}`);
  }

  /**
   * Retries an action with exponential backoff
   * Default: 3 retries with 1s, 2s, 4s delays
   */
  protected async retryWithBackoff<T>(
    action: () => Promise<T>,
    actionName: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await action();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries - 1) {
          const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          this.logger.warn(`Retry ${attempt + 1}/${maxRetries} for ${actionName} after ${delayMs}ms: ${lastError.message}`);
          await this.page.waitForTimeout(delayMs);
        }
      }
    }

    throw new Error(`Failed after ${maxRetries} retries: ${actionName} - ${lastError?.message}`);
  }
}
