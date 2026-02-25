import { type User } from '../../user/user.domain';

export class TrashEmptyRequestedEvent {
  constructor(
    public readonly user: User,
    public readonly trashedFilesNumber: number,
    public readonly trashedFoldersNumber: number,
  ) {}
}
