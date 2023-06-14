import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import logger, { LogType } from '../../logger';
import { UsernameChangedEvent } from '../events/username-changed.event';
import { BridgeService } from '../../../externals/bridge/bridge.service';

@Injectable()
export class NetworkListener {
  private readonly id = 'network-listener';

  constructor(private readonly networkService: BridgeService) {}

  @OnEvent(UsernameChangedEvent.id)
  handleUsernameChangedEvent({ user, payload }: UsernameChangedEvent) {
    const { newUsername } = payload;
    const { uuid } = user;
    const logId = `${this.id}-${UsernameChangedEvent.id}`;

    logger(LogType.Info, {
      user: uuid,
      message: 'Received',
      id: logId,
    });

    this.networkService
      .updateUser(user.uuid, { email: newUsername })
      .then(() => {
        logger(LogType.Info, {
          user: uuid,
          message: 'Processed succesfully',
          id: logId,
        });
      })
      .catch((err) => {
        logger(LogType.Error, {
          user: uuid,
          message: `Error: ${err.message}. ${err.stack}`,
          id: logId,
        });
      });
  }
}
