import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ClientVersionPolicy } from './client-version-policy.domain';
import { ClientVersionPolicyModel } from './client-version-policy.model';

export abstract class ClientVersionPolicyRepository {
  abstract findAll(): Promise<ClientVersionPolicy[]>;
}

@Injectable()
export class SequelizeClientVersionPolicyRepository implements ClientVersionPolicyRepository {
  constructor(
    @InjectModel(ClientVersionPolicyModel)
    private readonly policyModel: typeof ClientVersionPolicyModel,
  ) {}

  async findAll(): Promise<ClientVersionPolicy[]> {
    const policies = await this.policyModel.findAll();
    return policies.map((policy) => ClientVersionPolicy.build(policy.toJSON()));
  }
}
