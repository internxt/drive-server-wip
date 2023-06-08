import dotenv from 'dotenv';

dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import apiMetrics from 'prometheus-api-metrics';
import helmet from 'helmet';
import {
  DocumentBuilder,
  SwaggerCustomOptions,
  SwaggerModule,
} from '@nestjs/swagger';
import { TransformInterceptor } from './lib/transform.interceptor';
import { RequestLoggerMiddleware } from './middlewares/requests-logger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AuthGuard } from './modules/auth/auth.guard';

const APP_PORT = process.env.PORT || 3000;
async function bootstrap() {
  const logger = new Logger();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      allowedHeaders: [
        'sessionId',
        'Content-Type',
        'Authorization',
        'method',
        'internxt-version',
        'internxt-client',
        'internxt-mnemonic',
        'x-share-password',
      ],
      exposedHeaders: ['sessionId'],
      origin: '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      preflightContinue: false,
    },
    // logger: WinstonLogger.getLogger(),
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalInterceptors(new TransformInterceptor());

  app.use(helmet());
  app.use(apiMetrics());

  app.use(RequestLoggerMiddleware);
  app.setGlobalPrefix('api');
  app.disable('x-powered-by');
  app.enableShutdownHooks();

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new AuthGuard(reflector));
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Drive API')
    .setDescription('Drive API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  const customOptions: SwaggerCustomOptions = {
    swaggerOptions: {
      persistAuthorization: true,
    },
  };

  SwaggerModule.setup('api', app, document, customOptions);
  await app.listen(APP_PORT);
  logger.log(`Application listening on port: ${APP_PORT}`);
}
bootstrap();
