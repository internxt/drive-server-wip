import { Test, type TestingModule } from '@nestjs/testing';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { v4 } from 'uuid';
import { AppModule } from '../../src/app.module';
import { TransformInterceptor } from '../../src/lib/transform.interceptor';
import { AuthGuard } from '../../src/modules/auth/auth.guard';
import { BridgeService } from '../../src/externals/bridge/bridge.service';
import { MailerService } from '../../src/externals/mailer/mailer.service';
import { NewsletterService } from '../../src/externals/newsletter';
import { NotificationListener } from '../../src/externals/notifications/listeners/notification.listener';

class MockBridgeService {
  async createUser() {
    return {
      userId: `$2a$08$${v4().replace(/-/g, '').substring(0, 53)}`,
      uuid: v4(),
    };
  }

  async createBucket() {
    return { id: v4().substring(0, 24), name: 'test-bucket' };
  }

  async deleteFile() {
    return;
  }
}

class MockMailerService {
  async send() {
    return;
  }
}

class MockNewsletterService {
  async subscribe() {
    return;
  }
}

class MockNotificationListener {
  async handleNotificationEvent() {
    return;
  }
}

export interface CreateTestAppOptions {
  enableAuthGuard?: boolean;
  enableValidationPipe?: boolean;
  enableTransformInterceptor?: boolean;
  enableExtendedQueryParser?: boolean;
}

export async function createTestApp(
  options: CreateTestAppOptions = {},
): Promise<NestExpressApplication> {
  const {
    enableAuthGuard = true,
    enableValidationPipe = true,
    enableTransformInterceptor = true,
    enableExtendedQueryParser = true,
  } = options;
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(BridgeService)
    .useClass(MockBridgeService)
    .overrideProvider(MailerService)
    .useClass(MockMailerService)
    .overrideProvider(NewsletterService)
    .useClass(MockNewsletterService)
    .overrideProvider(NotificationListener)
    .useClass(MockNotificationListener)
    .compile();
  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  if (enableAuthGuard) {
    const reflector = app.get(Reflector);
    app.useGlobalGuards(new AuthGuard(reflector));
  }
  if (enableExtendedQueryParser) {
    app.set('query parser', 'extended');
  }
  if (enableValidationPipe) {
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
  }
  if (enableTransformInterceptor) {
    app.useGlobalInterceptors(new TransformInterceptor());
  }
  await app.init();

  return app;
}
