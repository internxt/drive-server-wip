import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceAttributes } from '../attributes/workspace.attributes';

export class EditBillingAddressDto {
  @ApiProperty({
    example:
      'La marina de Valencia, Muelle de la Aduana s/n, 46024 Valencia, Spain',
    description: 'Workspace billing address',
  })
  @IsNotEmpty()
  @IsString()
  @Length(5, 255)
  address: WorkspaceAttributes['address'];
}
