import { BridgeException } from './bridge.exception';

export class BridgeUserEmailAlreadyInUseException extends BridgeException {
  constructor(message = 'User: email already in use') {
    super(message);
  }
}
