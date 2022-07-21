import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import '@sentry/tracing';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
// import { WinstonLogger } from './lib/winston-logger';
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
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
  });
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

  app.use(RequestLoggerMiddleware);
  app.setGlobalPrefix('api');
  app.disable('x-powered-by');
  app.enableShutdownHooks();

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new AuthGuard(reflector));
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Drive Desktop')
    .setDescription('Drive Desktop API')
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
