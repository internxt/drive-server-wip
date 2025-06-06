// Jest setup file to handle BigInt serialization

if (typeof globalThis.BigInt === 'function') {
  if (!BigInt.prototype.toJSON) {
    BigInt.prototype.toJSON = function () {
      return this.toString();
    };
  }
}

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;
