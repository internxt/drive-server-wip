// Jest setup file to handle BigInt serialization

if (typeof globalThis.BigInt === 'function') {
  if (!BigInt.prototype.toJSON) {
    BigInt.prototype.toJSON = function () {
      return this.toString();
    };
  }
}

import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

import * as opaque from '@serenity-kit/opaque';

beforeAll(async () => {
  await opaque.ready;
});
