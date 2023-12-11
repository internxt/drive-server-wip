import { BridgeException } from './bridge.exception';

export class BridgeUserNotFoundException extends BridgeException {
  constructor(message = 'User: not found') {
    super(message);
  }
}
