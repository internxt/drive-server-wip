import { User } from '../user/user.domain';
import { SendLinkItem } from './send-link-item.domain';

export interface SendLinkAttributes {
  id: string;
  views: number;
  user: User | null;
  items: SendLinkItem[];
  sender: string;
  receivers: string[];
  code: string;
  title: string;
  subject: string;
  createdAt: Date;
  updatedAt: Date;
  expirationAt: Date;
}

export class SendLink implements SendLinkAttributes {
  id: string;
  views: number;
  user: User | null;
  items: SendLinkItem[];
  sender: string;
  receivers: string[];
  code: string;
  title: string;
  subject: string;
  createdAt: Date;
  updatedAt: Date;
  expirationAt: Date;
  constructor({
    id,
    views,
    user,
    items,
    sender,
    receivers,
    code,
    title,
    subject,
    createdAt,
    updatedAt,
    expirationAt,
  }) {
    this.id = id;
    this.setUser(user);
    this.views = views;
    this.setItems(items);
    this.sender = sender;
    this.receivers = receivers;
    this.code = code;
    this.title = title;
    this.subject = subject;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.expirationAt = expirationAt;
  }

  static build(send: SendLinkAttributes): SendLink {
    return new SendLink(send);
  }

  setUser(user: User | null) {
    this.user = user;
  }
  setItems(items: SendLinkItem[]) {
    this.clearItems();
    items.forEach((item) => this.addItem(item));
  }
  addItem(item: SendLinkItem) {
    this.items.push(item);
  }
  clearItems() {
    this.items = [];
  }
  removeItem(item: SendLinkItem) {
    const indexItem = this.items.findIndex((it) => it.id === item.id);
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
      receivers: this.receivers,
      code: this.code,
      title: this.title,
      subject: this.subject,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      expirationAt: this.expirationAt,
    };
  }
}
