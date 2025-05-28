import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

@Injectable()
export class HttpClient {
  private defaultOptions = {};
  constructor(private readonly http: HttpService) {}

  setDefaultOptions(options: object) {
    this.defaultOptions = options;
  }

  async get(url: string, options: object) {
    return await this.http
      .get(url, { ...this.defaultOptions, ...options })
      .toPromise();
  }

  async post(url: string, data: any, options: object) {
    return await this.http
      .post(url, data, { ...this.defaultOptions, ...options })
      .toPromise();
  }

  async put(url: string, data: any, options: object) {
    return await this.http
      .put(url, data, { ...this.defaultOptions, ...options })
      .toPromise();
  }

  async patch(url: string, data: any, options: object) {
    return await this.http
      .patch(url, data, { ...this.defaultOptions, ...options })
      .toPromise();
  }

  async delete(url: string, options: object) {
    return await this.http
      .delete(url, { ...this.defaultOptions, ...options })
      .toPromise();
  }
}
