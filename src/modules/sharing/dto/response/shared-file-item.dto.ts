import { ApiProperty, IntersectionType } from '@nestjs/swagger';
import { NetworkCredentialsDto, SharedItemBaseDto } from './shared-base.dto';
import { FileDto } from '../../../file/dto/file.dto';

export class SharedFileItemDto extends IntersectionType(
  FileDto,
  SharedItemBaseDto,
) {
  @ApiProperty({
    description: 'Network credentials for accessing this file',
    type: NetworkCredentialsDto,
    nullable: true,
  })
  credentials?: NetworkCredentialsDto | null;
}
