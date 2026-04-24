import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Employee } from '../modules/time-off/entities/employee.entity';
import { Location } from '../modules/time-off/entities/location.entity';
import { TimeOffBalance } from '../modules/time-off/entities/time-off-balance.entity';
import { TimeOffRequest } from '../modules/time-off/entities/time-off-request.entity';
import { BalanceSyncLog } from '../modules/time-off/entities/balance-sync-log.entity';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'sqlite',
  database: process.env.DB_DATABASE || './data/time-off.db',
  entities: [Employee, Location, TimeOffBalance, TimeOffRequest, BalanceSyncLog],
  synchronize: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test',
  logging: process.env.NODE_ENV === 'development',
  migrations: ['dist/migrations/*.js'],
  migrationsRun: process.env.NODE_ENV === 'production',
};

export const testDatabaseConfig: TypeOrmModuleOptions = {
  type: 'sqlite',
  database: ':memory:',
  entities: [Employee, Location, TimeOffBalance, TimeOffRequest, BalanceSyncLog],
  synchronize: true,
  dropSchema: true,
  logging: false,
};
