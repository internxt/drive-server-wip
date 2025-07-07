import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HttpAgent, HttpsAgent } from 'agentkeepalive';

import { HttpClient } from './http.service';

const agentConfig = {
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 10,
  timeout: 10000,
  freeSocketTimeout: 4000, // Set this value to prevent socket hang up errors as Nodejs timeout is 5000ms
};
@Module({
  imports: [
    HttpModule.register({
      httpsAgent: new HttpsAgent(agentConfig),
      httpAgent: new HttpAgent(agentConfig),
    }),
  ],
  controllers: [],
  providers: [HttpClient],
  exports: [HttpClient],
})
export class HttpClientModule {}
