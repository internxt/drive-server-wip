import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFolderRepository } from './folder.repository';
import { Folder } from './folder.model';
import { FolderService } from './folder.service';
import { CryptoModule } from '../crypto/crypto.module';

@Module({
  imports: [SequelizeModule.forFeature([Folder]), CryptoModule],
  controllers: [],
  providers: [SequelizeFolderRepository, FolderService],
  exports: [FolderService],
})
export class FolderModule {}
