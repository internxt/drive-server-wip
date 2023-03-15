import { NestMiddleware, Injectable, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Sequelize } from 'sequelize-typescript';

@Injectable()
export class UncaughtExceptionMiddleware implements NestMiddleware {
  constructor(private readonly database: Sequelize) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      await next();
    } catch (err) {
      Logger.error('Unhandled exception: ' + err.message);
    } finally {
      process.on('uncaughtException', () => {
        if (this.database) {
          this.database.close();
        }
        process.exit(1);
      });
    }
  }
}
