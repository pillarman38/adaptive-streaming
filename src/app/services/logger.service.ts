import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  private isNative: boolean;
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
    debug: typeof console.debug;
  };

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
      debug: console.debug.bind(console)
    };

    // Override console methods on native platforms to ensure proper formatting
    if (this.isNative) {
      this.setupNativeLogging();
    }
  }

  private setupNativeLogging() {
    const tag = 'AngularApp';

    // Override console.log
    console.log = (...args: any[]) => {
      const message = this.formatMessage(args);
      this.originalConsole.log(`[${tag}] ${message}`);
    };

    // Override console.error
    console.error = (...args: any[]) => {
      const message = this.formatMessage(args);
      this.originalConsole.error(`[${tag}] ${message}`);
    };

    // Override console.warn
    console.warn = (...args: any[]) => {
      const message = this.formatMessage(args);
      this.originalConsole.warn(`[${tag}] ${message}`);
    };

    // Override console.info
    console.info = (...args: any[]) => {
      const message = this.formatMessage(args);
      this.originalConsole.info(`[${tag}] ${message}`);
    };

    // Override console.debug
    console.debug = (...args: any[]) => {
      const message = this.formatMessage(args);
      this.originalConsole.debug(`[${tag}] ${message}`);
    };
  }

  private formatMessage(args: any[]): string {
    return args.map(arg => {
      if (arg === null) {
        return 'null';
      }
      if (arg === undefined) {
        return 'undefined';
      }
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          // Handle circular references
          try {
            return String(arg);
          } catch (e2) {
            return '[Object]';
          }
        }
      }
      return String(arg);
    }).join(' ');
  }

  // Public methods for explicit logging (optional, console methods are already overridden)
  log(...args: any[]): void {
    console.log(...args);
  }

  error(...args: any[]): void {
    console.error(...args);
  }

  warn(...args: any[]): void {
    console.warn(...args);
  }

  info(...args: any[]): void {
    console.info(...args);
  }

  debug(...args: any[]): void {
    console.debug(...args);
  }
}

