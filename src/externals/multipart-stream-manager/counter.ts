import { EventEmitter } from 'events';

class Counter extends EventEmitter {
  private value: number;

  constructor() {
    super();
    this.value = 0;
  }

  increment(): void {
    this.value++;
    this.emit('increment', this.value);
  }

  decrement(): void {
    this.value--;
    if (this.value === 0) {
      this.emit('zero');
    }
  }

  isZero(): boolean {
    return this.value === 0;
  }

  onceZero(fn: () => void): void {
    if (this.isZero()) {
      fn();
    } else {
      this.once('zero', fn);
    }
  }
}

export default Counter;
