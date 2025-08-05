import { Logger } from '@nestjs/common';
import { NextFunction, Request } from 'express';
import jwt from 'jsonwebtoken';

const logger = new Logger();
export function RequestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  let user = null;
  if (req.headers.authorization) {
    try {
      const userDecoded: any = jwt.decode(
        req.headers.authorization.split(' ')[1],
      );
      if (userDecoded.email) {
        user = userDecoded.email;
      } else {
        user = userDecoded;
      }
    } catch (e) {
      // no op
    }
  }

  const clientVersion =
    `[${req.headers['internxt-client']} ${req.headers['internxt-version']}]`.trim();
  const clientAuth = req.headers.authorization && user;
  logger.log(
    `[RequestsLogger] [${req.method}] ${req.originalUrl} ${
      clientAuth?.payload && ` [AUTH ${clientAuth.payload.username}]`
    } ${clientVersion}`,
  );
  next();
}
