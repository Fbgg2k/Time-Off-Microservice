import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveRequestDto {
  @ApiProperty({ description: 'ID of the manager approving the request', example: 'manager-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  reviewedBy: string;

  @ApiPropertyOptional({ 
    description: 'Comments about the approval', 
    example: 'Approved for team planning',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comments?: string;
}
