import { chromium } from "playwright";
import { sampleProfile } from "./profile";
import type { ApplicationResult, UserProfile } from "./types";

/**
 * ============================================================
 * TSENTA TAKE-HOME ASSESSMENT - ATS Form Automator
 * ============================================================
 *
 * Your task: Build an automation system that can fill out job
 * application forms across MULTIPLE ATS platforms using Playwright.
 *
 * There are two mock forms to automate:
 *
 *   1. Acme Corp    → http://localhost:3939/acme.html
 *      Multi-step form with progress bar, typeahead, checkboxes,
 *      radio buttons, conditional fields, file upload
 *
 *   2. Globex Corp  → http://localhost:3939/globex.html
 *      Single-page accordion form with toggle switches, chip
 *      selectors, salary slider, datalist, different selectors
 *
 * Your code should handle BOTH forms with a shared architecture.
 * Read the README for full instructions and evaluation criteria.
 */

const BASE_URL = "http://localhost:3939";

async function applyToJob(
  url: string,
  profile: UserProfile
): Promise<ApplicationResult> {
  const startTime = Date.now();

  // TODO: Implement your automation here
  //
  // Think about:
  //   - How do you detect which ATS/form you're on?
  //   - How do you share logic for common field types (text, dropdown, file upload)
  //     while handling platform-specific differences (typeahead vs datalist,
  //     checkboxes vs chips, radio buttons vs toggles)?
  //   - How would a third ATS be added without rewriting everything?

  throw new Error("Not implemented — this is your task!");
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
