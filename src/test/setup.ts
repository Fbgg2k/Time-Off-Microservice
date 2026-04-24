import { Test } from '@nestjs/testing';

// Simple test setup
export const setupTestApp = async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [],
  }).compile();

  return moduleRef;
};
