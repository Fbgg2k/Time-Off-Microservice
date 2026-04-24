import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CancelRequestDto {
  @ApiPropertyOptional({ 
    description: 'Reason for cancellation', 
    example: 'Emergency cancellation',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comments?: string;
}
