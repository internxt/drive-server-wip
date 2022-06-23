import { User } from '../user/user.domain';
import { SendLinkItem } from './send-link-item.domain';

export interface SendLinkAttributes {
  id: string;
  views: number;
  user: User | null;
  items: any;
  receiver: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
}

export class SendLink implements SendLinkAttributes {
  id: string;
  views: number;
  user: User | null;
  items: any;
  receiver: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
  constructor({
    id,
    views,
    user,
    items,
    receiver,
    code,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.setUser(user);
    this.views = views;
    this.setItems(items);
    this.receiver = receiver;
    this.code = code;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(send: SendLinkAttributes): SendLink {
    return new SendLink(send);
  }

  setUser(user) {
    if (user && !(user instanceof User)) {
      throw Error('user invalid');
    }
    this.user = user;
  }
  setItems(items) {
    this.clearItems();
    items.forEach((item) => this.addItem(item));
  }
  addItem(item) {
    if (item && !(item instanceof SendLinkItem)) {
      throw Error('send link item invalid');
    }
    this.items.push(item);
  }
  clearItems() {
    this.items = [];
  }
  removeItem(item) {
    const indexItem = this.items.find((it) => it.id === item.id);
    if (indexItem > -1) {
      this.items.slice(indexItem, 1);
    }
  }
  toJSON() {
    return {
      id: this.id,
      user: this.user ? this.user.toJSON() : null,
      items: this.items.map((item) => item.toJSON()),
      views: this.views,
      receiver: this.receiver,
      code: this.code,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
