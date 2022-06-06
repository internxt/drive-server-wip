import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HttpClient } from './http.service';
@Module({
  imports: [HttpModule],
  controllers: [],
  providers: [HttpClient],
  exports: [HttpClient],
})
export class HttpClientModule {}
