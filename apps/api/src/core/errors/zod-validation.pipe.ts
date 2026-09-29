import { Injectable, PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { z, type ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      throw new BadRequestException({
        type: 'https://nexaerp.dev/problems/validation-failed',
        title: 'Validation Failed',
        status: 422,
        code: 'VALIDATION_FAILED',
        detail: 'Request payload failed validation.',
        errors,
      });
    }
    return result.data;
  }
}

export function createZodPipe<T>(schema: ZodSchema<T>) {
  return new ZodValidationPipe(schema);
}
