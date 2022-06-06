import { WinstonModule } from 'nest-winston';
import winston from 'winston';
import os from 'os';

const { splat, combine, printf, timestamp } = winston.format;
const serverHostname = os.hostname();
const colorize = winston.format.colorize({ all: true });

export class WinstonLogger {
  private static prodOptions = {
    level: 'info',
    exitOnError: true,
    handleExceptions: true,
    format: combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      printf((info) => {
        return JSON.stringify({
          hostname: serverHostname,
          requestId: (info.meta && info.meta.requestId) ?? '0',
          timestamp: info.timestamp,
          level: info.level,
          message: info.message,
          meta: info.meta ?? {},
        });
      }),
    ),
    transports: [new winston.transports.Console()],
  };

  private static devOptions = {
    level: 'info',
    exitOnError: true,
    handleExceptions: true,
    format: combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      splat(),
      printf((info) => {
        const nest = colorize.colorize(info.level, `[NEST] `);
        const message = colorize.colorize(
          info.level,
          `${info.level}: ${info.message}`,
        );
        return `${nest} ${info.timestamp} - ${serverHostname} ${message}`;
      }),
    ),
    transports: [new winston.transports.Console()],
  };

  static getLogger() {
    const configs = {
      production: WinstonModule.createLogger(this.prodOptions),
      staging: WinstonModule.createLogger(this.prodOptions),
      development: null,
    };
    return configs[process.env.NODE_EV] || null;
  }
}
