import { IsString, IsNotEmpty, IsDateString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BalanceType } from '../entities/time-off-balance.entity';

export class CreateTimeOffRequestDto {
  @ApiProperty({ description: 'Employee ID', example: 'emp-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  employeeId: string;

  @ApiProperty({ description: 'Location ID', example: 'loc-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  locationId: string;

  @ApiProperty({ 
    description: 'Balance type', 
    enum: BalanceType, 
    example: BalanceType.ANNUAL 
  })
  @IsEnum(BalanceType)
  balanceType: BalanceType;

  @ApiProperty({ 
    description: 'Start date (YYYY-MM-DD)', 
    example: '2024-02-01',
    type: String
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ 
    description: 'End date (YYYY-MM-DD)', 
    example: '2024-02-05',
    type: String
  })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiPropertyOptional({ 
    description: 'Comments about the request', 
    example: 'Family vacation',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comments?: string;
}
