import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { File } from '../file/file.model';
import { ShareController } from './share.controller';
import { Share } from './share.model';
import { SequelizeShareRepository } from './share.repository';
import { ShareService } from './share.service';

@Module({
  imports: [SequelizeModule.forFeature([Share, File])],
  controllers: [ShareController],
  providers: [SequelizeShareRepository, ShareService],
})
export class ShareModule {}
