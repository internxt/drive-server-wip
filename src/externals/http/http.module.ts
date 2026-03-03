import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import {
  HttpAgent,
  type HttpOptions,
  HttpsAgent,
  type HttpsOptions,
} from 'agentkeepalive';

import { HttpClient } from './http.service';

const agentConfig: HttpsOptions | HttpOptions = {
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 30,
  timeout: 8000, // Default timeout for the agent.
  freeSocketTimeout: 4000, // Set this value to prevent socket hang up errors as Nodejs timeout is 5000ms
};

const httpsAgent = new HttpsAgent(agentConfig);
const httpAgent = new HttpAgent(agentConfig);

@Module({
  imports: [
    HttpModule.register({
      httpsAgent: httpsAgent,
      httpAgent: httpAgent,
    }),
  ],
  controllers: [],
  providers: [HttpClient],
  exports: [HttpClient],
})
export class HttpClientModule {}
