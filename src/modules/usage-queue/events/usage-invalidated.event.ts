export class UsageInvalidatedEvent {
  constructor(
    public readonly userUuid: string,
    public readonly userId: number,
    public readonly source: string,
  ) {}
}
