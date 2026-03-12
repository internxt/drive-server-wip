import { Module } from '@nestjs/common';
import { HttpClientModule } from '../../externals/http/http.module';
import { CelloController } from './cello.controller';
import { CelloService } from './cello.service';

@Module({
  imports: [HttpClientModule],
  controllers: [CelloController],
  providers: [CelloService],
})
export class CelloModule {}
