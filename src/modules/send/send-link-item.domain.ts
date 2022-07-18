export interface SendLinkItemAttributes {
  id: string;
  name: string;
  type: string;
  linkId: string;
  networkId: string;
  encryptionKey: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class SendLinkItem implements SendLinkItemAttributes {
  id: string;
  name: string;
  type: string;
  linkId: string;
  networkId: string;
  encryptionKey: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  version: number;

  constructor({
    id,
    name,
    type,
    linkId,
    networkId,
    encryptionKey,
    size,
    createdAt,
    updatedAt,
    version,
  }: SendLinkItemAttributes) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.linkId = linkId;
    this.networkId = networkId;
    this.encryptionKey = encryptionKey;
    this.size = size;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.version = version;
  }

  static build(sendLinkItem: SendLinkItemAttributes): SendLinkItem {
    return new SendLinkItem(sendLinkItem);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      linkId: this.linkId,
      networkId: this.networkId,
      encryptionKey: this.encryptionKey,
      size: this.size,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version,
    };
  }
}
