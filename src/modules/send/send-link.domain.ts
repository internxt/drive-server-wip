import { type User } from '../user/user.domain';
import { type SendLinkItem } from './send-link-item.domain';

export interface SendLinkAttributes {
  id: string;
  views: number;
  user: User | null;
  items: SendLinkItem[];
  sender: string | null;
  receivers: string[] | null;
  code: string;
  title: string | null;
  subject: string | null;
  createdAt: Date;
  updatedAt: Date;
  expirationAt: Date;
  hashedPassword: string | null;
}

export class SendLink implements SendLinkAttributes {
  id: string;
  views: number;
  user: User | null;
  items: SendLinkItem[];
  sender: string | null;
  receivers: string[] | null;
  code: string;
  title: string;
  subject: string;
  createdAt: Date;
  updatedAt: Date;
  expirationAt: Date;
  hashedPassword: string | null;

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
    hashedPassword,
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
    this.hashedPassword = hashedPassword;
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

  get size() {
    return this.items.reduce(
      (acc, item) => acc + (item.type === 'file' ? item.size : 0),
      0,
    );
  }

  addView() {
    this.views++;
  }

  public isProtected(): boolean {
    return this.hashedPassword !== null;
  }

  toJSON() {
    return {
      id: this.id,
      user: this.user ? this.user.toJSON() : null,
      items: this.items.map((item) => item.toJSON()),
      views: this.views,
      sender: this.sender,
      receivers: this.receivers,
      code: this.code,
      title: this.title,
      subject: this.subject,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      expirationAt: this.expirationAt,
      protected: this.isProtected(),
    };
  }
}
