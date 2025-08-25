import { Injectable } from '@nestjs/common';
import { SequelizeUsageRepository } from './usage.repository';

@Injectable()
export class UsageService {
  constructor(private readonly usageRepository: SequelizeUsageRepository) {}
}
