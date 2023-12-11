export class BridgeException extends Error {
  constructor(message: string) {
    super(message);
    this.message = `[Bridge] -> ${message}`;
  }
}
