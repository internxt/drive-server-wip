export interface SendLinkItemAttributes {
  id: string;
  name: string;
  type: string;
  linkId: string;
  networkId: string;
  encryptionKey: string;
  size: number;
  parentId: string | null;
  childrens: Array<SendLinkItem>;
  createdAt: Date;
  updatedAt: Date;
}

export class SendLinkItem implements SendLinkItemAttributes {
  id: string;
  name: string;
  type: string;
  linkId: string;
  networkId: string;
  encryptionKey: string;
  size: number;
  parentId: string | null;
  childrens: Array<SendLinkItem>;
  path: string | null;
  createdAt: Date;
  updatedAt: Date;
  constructor({
    id,
    name,
    type,
    linkId,
    networkId,
    encryptionKey,
    size,
    parentId,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.linkId = linkId;
    this.networkId = networkId;
    this.encryptionKey = encryptionKey;
    this.size = size;
    this.parentId = parentId;
    this.childrens = [];
    this.path = null;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(sendLinkItem: SendLinkItemAttributes): SendLinkItem {
    return new SendLinkItem(sendLinkItem);
  }

  setChildrens(childrens: Array<SendLinkItem>) {
    this.childrens = childrens;
  }
  addChildren(children: SendLinkItem) {
    this.childrens.push(children);
  }
  removeChildren(children: SendLinkItem) {
    this.childrens.splice(this.childrens.indexOf(children), 1);
  }
  getChildrens() {
    return this.childrens;
  }
  clearChildrens() {
    this.childrens = [];
  }

  getPath() {
    return this.path;
  }

  generatePath(prefix = '') {
    if (prefix != '') {
      this.path = prefix + '/' + this.id;
    } else {
      this.path = this.id;
    }
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
    };
  }
}
