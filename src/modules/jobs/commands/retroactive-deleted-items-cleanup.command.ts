import { NestFactory } from '@nestjs/core';
import { RetroActiveDeleteItemsCleanupTask } from '../tasks/retroactive-items-cleanup.task';
import { AppModule } from '../../../app.module';

async function main() {
  const userId = process.argv
    .find((arg) => arg.startsWith('--userId='))
    ?.split('=')[1];

  const app = await NestFactory.createApplicationContext(AppModule);
  const cleanupTask = app.get(RetroActiveDeleteItemsCleanupTask);

  const options = userId ? { startFromUserId: parseInt(userId) } : null;
  await cleanupTask.cleanupOrphanedFolders(options);

  await app.close();
  process.exit(0);
}

main().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});
