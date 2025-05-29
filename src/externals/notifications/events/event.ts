export class Event {
  private readonly createdAt: Date;
  constructor(
    public name: string,
    public payload: Record<string, any>,
  ) {
    this.createdAt = new Date();
  }
}
