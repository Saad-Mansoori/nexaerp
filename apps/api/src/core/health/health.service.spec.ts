import { ProblemDetailsException } from '../errors/problem-details.exception.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('reports ready when the database answers', async () => {
    const $queryRaw = jest.fn().mockResolvedValue([[1]]);
    const service = new HealthService({ $queryRaw } as unknown as PrismaService);

    await expect(service.ready()).resolves.toBe('ready');
    expect($queryRaw).toHaveBeenCalledTimes(1);
  });

  it('throws a 503 problem without leaking connection details', async () => {
    const $queryRaw = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432'));
    const service = new HealthService({ $queryRaw } as unknown as PrismaService);

    await expect(service.ready()).rejects.toBeInstanceOf(ProblemDetailsException);
    try {
      await service.ready();
      throw new Error('expected ready() to reject');
    } catch (error) {
      const problem = error as ProblemDetailsException;
      expect(problem.httpStatus).toBe(503);
      expect(problem.code).toBe('SERVICE_UNAVAILABLE');
      expect(problem.detail).toBe('Database is not reachable.');
      expect(String(problem.detail)).not.toContain('ECONNREFUSED');
    }
  });
});
