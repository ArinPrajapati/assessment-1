import { chromium } from "playwright";
import { sampleProfile } from "./profile.js";
import type { ApplicationResult, UserProfile } from "./types.js";
import { BrowserManager } from "./core/BrowserManager.js";
import { Logger } from "./utils/logger.js";
import { PlatformRegistry } from "./platforms/PlatformRegistry.js";
import { AcmeAdapter } from "./platforms/AcmeAdapter.js";
import { GlobexAdapter } from "./platforms/GlobexAdapter.js";

const BASE_URL = "http://localhost:3939";
const SCREENSHOT_DIR = "./screenshots";

async function applyToJob(
  url: string,
  profile: UserProfile
): Promise<ApplicationResult> {
  const logger = new Logger();
  const browserManager = new BrowserManager(logger, false, "../screenshots/");

  const registry = new PlatformRegistry(logger);
  registry.register('Acme Corp', /\/acme\.html/, AcmeAdapter);
  registry.register('Globex Corp', /\/globex\.html/, GlobexAdapter);

  let browser = null;
  let page = null;

  try {
    browser = await browserManager.launch();
    page = await browserManager.createPage();

    await page.goto(url, { waitUntil: 'networkidle' });
    logger.info(`Navigated to: ${url}`);

    const adapter = registry.createAdapter(url, page, profile, SCREENSHOT_DIR);
    const result = await adapter.run();

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Application failed: ${errorMessage}`, error instanceof Error ? error : undefined);

    return {
      success: false,
      error: errorMessage,
      durationMs: 0
    };
  } finally {
    if (browser) {
      await browser.close();
      logger.debug('Browser closed');
    }
  }
}

// ── Entry point ──────────────────────────────────────────────
async function main() {
  const targets = [
    { name: "Acme Corp", url: `${BASE_URL}/acme.html` },
    { name: "Globex Corporation", url: `${BASE_URL}/globex.html` },
  ];

  for (const target of targets) {
    console.log(`\n--- Applying to ${target.name} ---`);

    try {
      const result = await applyToJob(target.url, sampleProfile);

      if (result.success) {
        console.log(`  Application submitted!`);
        console.log(`  Confirmation: ${result.confirmationId}`);
        console.log(`  Duration: ${result.durationMs}ms`);
      } else {
        console.error(`  Failed: ${result.error}`);
      }
    } catch (err) {
      console.error(`  Fatal error:`, err);
    }
  }
}

main();
