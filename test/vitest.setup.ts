import 'reflect-metadata';

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

if (typeof BigInt === 'function' && !BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}
