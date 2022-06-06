import { Injectable } from '@nestjs/common';
import { SequelizeShareRepository } from './share.repository';

@Injectable()
export class ShareService {
  constructor(private shareRepository: SequelizeShareRepository) {}

  listByUser(user: any) {
    return this.shareRepository.findAllByUser(user);
  }
}
