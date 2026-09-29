import { HttpException } from '@nestjs/common';
import type { ErrorCode, FieldError } from '@nexaerp/shared';

export class ProblemDetailsException extends HttpException {
  constructor(
    public readonly httpStatus: number,
    public readonly code: ErrorCode,
    public readonly detail?: string,
    public readonly errors?: FieldError[],
  ) {
    super({ statusCode: httpStatus, code, detail, errors }, httpStatus);
  }
}
