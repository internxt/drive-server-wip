import { User } from '../user/user.domain';
import { LimitLabels, LimitTypes } from './limits.enum';

export interface LimitAttributes {
  id: string;
  label: LimitLabels;
  type: LimitTypes;
  value: number;
}

export interface MaxInviteesPerItemAttribute {
  itemId: string;
  itemType: 'folder' | 'file';
}

export interface MaxSharedItemsAttribute {
  user: User;
}

export interface LimitTypeMapping {
  [LimitLabels.MaxSharedItemInvites]: MaxInviteesPerItemAttribute;
  [LimitLabels.MaxSharedItems]: MaxSharedItemsAttribute;
  [key: string]: any;
}

type ExtractDataType<T> = T extends keyof LimitTypeMapping
  ? LimitTypeMapping[T]
  : never;

export type CheckFunction<T extends LimitLabels> = (
  value: number,
  user: User,
  data: ExtractDataType<T>,
) => Promise<boolean>;
