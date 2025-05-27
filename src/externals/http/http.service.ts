import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class HttpClient {
  private defaultOptions = {};
  constructor(private readonly http: HttpService) {}

  setDefaultOptions(options: object) {
    this.defaultOptions = options;
  }

  async get(url: string, options: object) {
    return await firstValueFrom(
      this.http.get(url, { ...this.defaultOptions, ...options }),
    );
  }

  async post(url: string, data: any, options: object) {
    return await firstValueFrom(
      this.http.post(url, data, { ...this.defaultOptions, ...options }),
    );
  }

  async put(url: string, data: any, options: object) {
    return await firstValueFrom(
      this.http.put(url, data, { ...this.defaultOptions, ...options }),
    );
  }

  async patch(url: string, data: any, options: object) {
    return await firstValueFrom(
      this.http.patch(url, data, { ...this.defaultOptions, ...options }),
    );
  }

  async delete(url: string, options: object) {
    return await firstValueFrom(
      this.http.delete(url, { ...this.defaultOptions, ...options }),
    );
  }
}
