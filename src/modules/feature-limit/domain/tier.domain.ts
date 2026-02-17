interface TierAttributes {
  id: string;
  label: string;
  context?: string;
}

export class Tier implements TierAttributes {
  id: string;
  label: string;
  context?: string;

  constructor(attributes: TierAttributes) {
    this.id = attributes.id;
    this.label = attributes.label;
    this.context = attributes.context;
  }

  static build(tier: TierAttributes): Tier {
    return new Tier(tier);
  }
}
