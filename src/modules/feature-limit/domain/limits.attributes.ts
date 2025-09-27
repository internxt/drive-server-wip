import { User } from '../../user/user.domain';
import { LimitTypes, FeatureLimits, AllLimits } from '../limits.enum';

export interface LimitAttributes {
  id: string;
  label: AllLimits;
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
  [FeatureLimits.MaxSharedItemInvites]: MaxInviteesPerItemAttribute;
  [FeatureLimits.MaxSharedItems]: MaxSharedItemsAttribute;

  [key: string]: any;
}
