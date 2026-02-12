/**
 * Structured logger with performance tracking
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'perf';

export class Logger {
  private logLevel: LogLevel;
  private performanceMetrics: Map<string, number> = new Map();

  constructor(logLevel: LogLevel = 'info') {
    this.logLevel = process.env.LOG_LEVEL as LogLevel || logLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'perf'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex || level === 'perf';
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const levelStr = level.toUpperCase().padEnd(5);
    return `[${timestamp}] ${levelStr} - ${message}`;
  }

  debug(message: string): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message));
    }
  }

  info(message: string): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message));
    }
  }

  warn(message: string): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message));
    }
  }

  error(message: string, error?: Error): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message));
      if (error) {
        console.error(error);
      }
    }
  }

  perf(action: string, durationMs: number, metadata?: Record<string, any>): void {
    this.performanceMetrics.set(action, durationMs);
    const metaStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
    const msg = `${action}: ${durationMs}ms${metaStr}`;
    console.log(this.formatMessage('perf', msg));
  }

  getMetrics(): Map<string, number> {
    return this.performanceMetrics;
  }

  printSummary(): void {
    if (this.performanceMetrics.size === 0) return;

    console.log('\n=== PERFORMANCE SUMMARY ===');
    let total = 0;
    for (const [action, duration] of this.performanceMetrics.entries()) {
      console.log(`  ${action}: ${duration}ms`);
      total += duration;
    }
    console.log(`  Total: ${total}ms`);
    console.log('===========================\n');
  }
}
