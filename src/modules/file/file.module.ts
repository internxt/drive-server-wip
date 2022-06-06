import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SequelizeFileRepository } from './file.repository';
import { File } from './file.model';
import { FileService } from './file.service';
import { CryptoModule } from '../../services/crypto/crypto.module';

@Module({
  imports: [SequelizeModule.forFeature([File]), CryptoModule],
  controllers: [],
  providers: [SequelizeFileRepository, FileService],
  exports: [FileService],
})
export class FileModule {}
