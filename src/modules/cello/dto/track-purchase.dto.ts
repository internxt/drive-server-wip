import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class TrackPurchaseDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  ucc: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  currency: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  invoiceId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  interval: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  productKey: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  subscriptionId: string;
}
