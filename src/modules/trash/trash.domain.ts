import { type TrashAttributes, type TrashItemType } from './trash.attributes';

export class Trash implements TrashAttributes {
  itemId: string;
  itemType: TrashItemType;
  caducityDate: Date;
  userId: number;

  private constructor(attributes: TrashAttributes) {
    this.itemId = attributes.itemId;
    this.itemType = attributes.itemType;
    this.caducityDate = attributes.caducityDate;
    this.userId = attributes.userId;
  }

  static build(attributes: TrashAttributes): Trash {
    return new Trash(attributes);
  }

  toJSON() {
    return {
      itemId: this.itemId,
      itemType: this.itemType,
      caducityDate: this.caducityDate,
      userId: this.userId,
    };
  }
}
