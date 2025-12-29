import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { Capacitor } from '@capacitor/core';

import { AppModule } from './app/app.module';

// Setup console logging for native platforms early
if (Capacitor.isNativePlatform()) {
  const tag = 'AngularApp';
  const originalLog = console.log.bind(console);
  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalInfo = console.info.bind(console);
  const originalDebug = console.debug.bind(console);

  const formatMessage = (args: any[]): string => {
    return args.map(arg => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          try {
            return String(arg);
          } catch (e2) {
            return '[Object]';
          }
        }
      }
      return String(arg);
    }).join(' ');
  };

  console.log = (...args: any[]) => {
    originalLog(`[${tag}] ${formatMessage(args)}`);
  };

  console.error = (...args: any[]) => {
    originalError(`[${tag}] ${formatMessage(args)}`);
  };

  console.warn = (...args: any[]) => {
    originalWarn(`[${tag}] ${formatMessage(args)}`);
  };

  console.info = (...args: any[]) => {
    originalInfo(`[${tag}] ${formatMessage(args)}`);
  };

  console.debug = (...args: any[]) => {
    originalDebug(`[${tag}] ${formatMessage(args)}`);
  };
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => {
    console.error('Error bootstrapping Angular application:', err);
    if (err instanceof Error) {
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
    } else {
      console.error('Error details:', JSON.stringify(err, null, 2));
    }
  });
