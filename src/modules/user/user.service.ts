import { Injectable } from '@nestjs/common';
import { SequelizeUserRepository } from './user.repository';

@Injectable()
export class UserService {
  constructor(private userRepository: SequelizeUserRepository) {}

  async getUserByUsername(email: string) {
    return await this.userRepository.findByUsername(email);
  }
}
