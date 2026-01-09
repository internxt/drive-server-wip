import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { type Request, type Response, type NextFunction } from 'express';
const newrelic = require('newrelic')

/**
 * Only for the headers, the instrumentation is not done directly here
 */
@Injectable()
export class NewRelicMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    try {
      let rawClient = req.headers['internxt-client'];
      let rawVersion = req.headers['internxt-version'];
      rawClient = Array.isArray(rawClient) ? rawClient[0] : rawClient;
      rawVersion = Array.isArray(rawVersion) ? rawVersion[0] : rawVersion;

      if (rawClient) {
        const client = String(rawClient).slice(0, 50);
        newrelic.addCustomAttribute('internxt-client', client); 
      }
      if (rawVersion) {
        const version = String(rawVersion).slice(0, 15);
        newrelic.addCustomAttribute('internxt-version', version);
      }
      console.log(rawClient, rawVersion)
    } catch (err) {
      new Logger('NewRelic').error('Error identifying headers', err);
    }
    next();
  }
}