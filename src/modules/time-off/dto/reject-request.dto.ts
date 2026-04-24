import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectRequestDto {
  @ApiProperty({ description: 'ID of the manager rejecting the request', example: 'manager-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  reviewedBy: string;

  @ApiProperty({ 
    description: 'Reason for rejection (required)', 
    example: 'Insufficient team coverage',
    maxLength: 500
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  comments: string;
}
