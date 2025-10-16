import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { TransformInterceptor } from '../../src/lib/transform.interceptor';
import { AuthGuard } from '../../src/modules/auth/auth.guard';

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
  }).compile();
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
