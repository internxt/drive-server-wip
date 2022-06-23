import { File } from '../file/file.domain';
import { Folder } from '../folder/folder.domain';
import { SendLink } from './send-link.domain';
export const SendLinkItemTypes = {
  FILE: 'file',
  FOLDER: 'folder',
};

export interface SendLinkItemAttributes {
  id: string;
  item: any;
  type: string;
  link: SendLink;
  networkId: string;
  encryptionKey: string;
  size: bigint;
  createdAt: Date;
  updatedAt: Date;
}

export class SendLinkItem implements SendLinkItemAttributes {
  id: string;
  item: any;
  type: string;
  link: any;
  networkId: string;
  encryptionKey: string;
  size: bigint;
  createdAt: Date;
  updatedAt: Date;
  constructor({
    id,
    item,
    type,
    link,
    networkId,
    encryptionKey,
    size,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.setItem(item);
    this.setType(type);
    this.setLink(link);
    this.networkId = networkId;
    this.encryptionKey = encryptionKey;
    this.size = size;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(sendLinkItem: SendLinkItemAttributes): SendLinkItem {
    return new SendLinkItem(sendLinkItem);
  }
  setItem(item) {
    if (!(item instanceof File) && !(item instanceof Folder)) {
      throw new Error('item must be instance of File or Folder');
    }
    this.item = item;
  }

  setType(type) {
    if (!Object.values(SendLinkItemTypes).includes(type)) {
      throw new Error(`type ${type} is not valid`);
    }
    this.type = type;
  }
  setLink(link) {
    if (!(link instanceof SendLink)) {
      throw new Error('link must be instance of SendLink');
    }
    this.link = link;
  }
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      link: this.link,
      networkId: this.networkId,
      encryptionKey: this.encryptionKey,
      size: this.size,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
