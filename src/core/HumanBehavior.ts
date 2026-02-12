/**
 * Human-like behavior for anti-bot detection
 */

import { Page, Locator } from 'playwright';

export type FieldType = 'text' | 'email' | 'phone' | 'date' | 'number';

export class HumanBehavior {
  private page: Page;
  private minDelay: number;
  private maxDelay: number;

  constructor(page: Page) {
    this.page = page;
    this.minDelay = parseInt(process.env.MIN_DELAY || '50');
    this.maxDelay = parseInt(process.env.MAX_DELAY || '300');
  }

  /**
   * Random delay between min and max milliseconds
   */
  async randomDelay(min?: number, max?: number): Promise<void> {
    const minMs = min ?? this.minDelay;
    const maxMs = max ?? this.maxDelay;
    const delay = minMs + Math.random() * (maxMs - minMs);
    await this.page.waitForTimeout(delay);
  }

  /**
   * Type text with variable speed to mimic human typing
   */
  async typeWithVariableSpeed(
    text: string,
    fieldType: FieldType = 'text'
  ): Promise<void> {
    // Email and phone fields - no pauses (avoid triggering validation)
    const avoidPauses = fieldType === 'email' || fieldType === 'phone';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Base typing speed
      let charDelay = 100 + Math.random() * 100; // 100-200ms

      // Slower for numbers and special characters
      if (/[0-9!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(char)) {
        charDelay = 150 + Math.random() * 100; // 150-250ms
      }

      // Type the character
      await this.page.keyboard.type(char, { delay: charDelay });

      // Occasional thinking pauses (every 10-15 chars)
      if (!avoidPauses && i > 0 && i % (10 + Math.floor(Math.random() * 5)) === 0) {
        await this.randomDelay(300, 500);
      }
    }
  }

  /**
   * Hover before clicking to simulate human mouse movement
   */
  async hoverBeforeClick(element: Locator): Promise<void> {
    await element.hover();
    await this.randomDelay(100, 300);
  }

  /**
   * Click at a random position within element bounds (not always center)
   */
  async clickWithOffset(element: Locator): Promise<void> {
    const box = await element.boundingBox();

    if (!box) {
      await element.click();
      return;
    }

    // Click within 30-70% of element width/height (avoid edges)
    const offsetX = box.width * (0.3 + Math.random() * 0.4);
    const offsetY = box.height * (0.3 + Math.random() * 0.4);

    await element.click({ position: { x: offsetX, y: offsetY } });
  }
}
