import { type User } from '../../user/user.domain';
import { type LimitLabels, type LimitTypes } from '../limits.enum';

export interface LimitAttributes {
  id: string;
  label: LimitLabels;
  type: LimitTypes;
  value: string;
}

export interface ShouldLimitBeEnforcedContext {
  bypassLimit?: boolean;
  currentCount?: number;
}

export interface MaxInviteesPerItemAttribute {
  itemId: string;
  itemType: 'folder' | 'file';
}

export interface MaxSharedItemsAttribute {
  user: User;
  itemId: string;
  isPublicSharing: boolean;
}

export interface PlatformAccessAttribute {
  platform: string;
}

export interface LimitTypeMapping {
  [LimitLabels.MaxSharedItemInvites]: MaxInviteesPerItemAttribute;
  [LimitLabels.MaxSharedItems]: MaxSharedItemsAttribute;
  [LimitLabels.PlatformAccess]: PlatformAccessAttribute;
  [key: string]: any;
}
