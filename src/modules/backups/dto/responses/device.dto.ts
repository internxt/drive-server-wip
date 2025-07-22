import { ApiProperty } from '@nestjs/swagger';
import { DevicePlatform } from '../../device.domain';
import { DeviceAsFolder } from './device-as-folder.dto';

export class DeviceDto {
  constructor(partial: Partial<DeviceDto>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ example: 7 })
  id: number;

  @ApiProperty({
    example: null,
    nullable: true,
    description: 'MAC address of the device',
  })
  mac?: string;

  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({
    example: DevicePlatform.LINUX,
    description: 'Device platform',
    enum: DevicePlatform,
    enumName: 'DevicePlatform',
  })
  platform: DevicePlatform;

  @ApiProperty({
    example: 'DESKTOP-ABC123ddd3',
    description: 'Unique installation identifier',
  })
  key: string;

  @ApiProperty({ example: 'UNKNOWN_HOSTNAME', description: 'Device hostname' })
  hostname: string;

  @ApiProperty({ example: '077e1ec6-9272-4719-ae1a-2ae35883a09e' })
  folderUuid: string;

  @ApiProperty({ example: '2025-07-10T20:14:04.784Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-07-10T20:14:04.784Z' })
  updatedAt: Date;

  @ApiProperty({ type: DeviceAsFolder, nullable: true })
  folder?: DeviceAsFolder;
}
