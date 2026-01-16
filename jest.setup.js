// Jest setup file to handle BigInt serialization

if (typeof globalThis.BigInt === 'function') {
  if (!BigInt.prototype.toJSON) {
    BigInt.prototype.toJSON = function () {
      return this.toString();
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const opaque = require('@serenity-kit/opaque');

beforeAll(async () => {
  await opaque.ready;
});
