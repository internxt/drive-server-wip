import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class UpdateFileMetaDto {
  @IsString()
  @ApiProperty({
    example: 'New name',
    description: 'The name the file is going to be updated to',
  })
  @Transform(({ value }: { value: string }) => value?.trimStart())
  @IsOptional()
  plainName?: string;

  @IsString()
  @ApiProperty({
    example: 'New type',
    description: 'The new type that the file is going to have',
  })
  @Transform(({ value }: { value: string }) => value?.trimEnd())
  @IsOptional()
  type?: string;
}
