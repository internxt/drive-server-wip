import { User } from '../user/user.domain';
import { LimitLabels, LimitTypes } from './limits.enum';

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

export interface MaxFileUploadSizeAttribute {
  file: { size: number };
}

export interface MaxSharedItemsAttribute {
  user: User;
  itemId: string;
  isPublicSharing: boolean;
}

export interface LimitTypeMapping {
  [LimitLabels.MaxSharedItemInvites]: MaxInviteesPerItemAttribute;
  [LimitLabels.MaxSharedItems]: MaxSharedItemsAttribute;
  [LimitLabels.MaxFileUploadSize]: MaxSharedItemsAttribute;
  [key: string]: any;
}
