import dotenv from 'dotenv';

dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import apiMetrics from 'prometheus-api-metrics';
import helmet from 'helmet';
import {
  DocumentBuilder,
  SwaggerCustomOptions,
  SwaggerModule,
} from '@nestjs/swagger';
import { AppModule } from './app.module';
import configuration from './config/configuration';
import { TransformInterceptor } from './lib/transform.interceptor';
import { AuthGuard } from './modules/auth/auth.guard';
import { RequestLoggerInterceptor } from './middlewares/requests-logger.interceptor';
import { NewRelicInterceptor } from './lib/newrelic.interceptor';

const config = configuration();
const APP_PORT = config.port || 3000;

async function bootstrap() {
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
        'X-Internxt-Captcha',
        'x-internxt-workspace',
        'internxt-resources-token',
      ],
      exposedHeaders: ['sessionId'],
      origin: '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      preflightContinue: false,
    },
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));
  const logger = app.get(Logger);

  const enableTrustProxy = config.isProduction;

  app.set('trust proxy', enableTrustProxy);
  // Express v5 changed this to 'simple' by default, we need the same behavior as v4
  app.set('query parser', 'extended');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalInterceptors(new NewRelicInterceptor());

  app.use(helmet());
  app.use(apiMetrics());

  if (!config.isProduction) {
    app.useGlobalInterceptors(new RequestLoggerInterceptor());
  }

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
    .addBearerAuth(undefined, 'gateway')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    ignoreGlobalPrefix: true,
  });

  const customOptions: SwaggerCustomOptions = {
    swaggerOptions: {
      persistAuthorization: true,
    },
  };

  SwaggerModule.setup('api', app, document, customOptions);
  await app.listen(APP_PORT);
  logger.log(`Application listening on port: ${APP_PORT}`);
  logger.log(`Trusting proxy enabled: ${enableTrustProxy ? 'yes' : 'no'}`);
}
bootstrap();
