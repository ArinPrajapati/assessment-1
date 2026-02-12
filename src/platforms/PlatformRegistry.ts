import { Page } from 'playwright';
import { UserProfile } from '../types.js';
import { Logger } from '../utils/logger.js';
import { BasePlatform } from '../core/BasePlatform.js';

type PlatformConstructor = new (
  page: Page,
  profile: UserProfile,
  logger: Logger,
  screenshotDir: string,
  platformName: string
) => BasePlatform;

interface PlatformConfig {
  name: string;
  urlPattern: RegExp;
  adapter: PlatformConstructor;
}

export class PlatformRegistry {
  private platforms: PlatformConfig[] = [];
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  register(name: string, urlPattern: RegExp, adapter: PlatformConstructor): void {
    this.platforms.push({ name, urlPattern, adapter });
    this.logger.debug(`Registered platform: ${name} (pattern: ${urlPattern})`);
  }

  detectPlatform(url: string): PlatformConfig | null {
    for (const platform of this.platforms) {
      if (platform.urlPattern.test(url)) {
        this.logger.info(`Detected platform: ${platform.name}`);
        return platform;
      }
    }

    this.logger.error(`No platform detected for URL: ${url}`);
    return null;
  }

  createAdapter(
    url: string,
    page: Page,
    profile: UserProfile,
    screenshotDir: string
  ): BasePlatform {
    const platform = this.detectPlatform(url);

    if (!platform) {
      throw new Error(`No platform adapter found for URL: ${url}`);
    }

    return new platform.adapter(page, profile, this.logger, screenshotDir, platform.name);
  }
}
