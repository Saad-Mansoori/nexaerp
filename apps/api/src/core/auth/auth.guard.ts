import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHmac, timingSafeEqual } from 'crypto';

import { PrismaService } from '../prisma/prisma.service.js';
import { AppConfigService } from '../config/app-config.service.js';
import { PUBLIC_KEY } from './auth.decorator.js';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  exp: number;
  iat: number;
  iss: string;
  aud: string;
}

function base64UrlDecode(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }
  return Buffer.from(base64, 'base64');
}

function parseJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [, payloadPart, signaturePart] = parts;
    if (!payloadPart || !signaturePart) return null;
    const payload = JSON.parse(base64UrlDecode(payloadPart).toString());
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      return null;
    }
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

function verifyJwtSignature(token: string, secret: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [headerPart, payloadPart, signaturePart] = parts;
    if (!headerPart || !payloadPart || !signaturePart) return false;
    const signingInput = `${headerPart}.${payloadPart}`;
    const signature = base64UrlDecode(signaturePart);
    const expectedSignature = createHmac('sha256', secret).update(signingInput).digest();
    return timingSafeEqual(signature, expectedSignature);
  } catch {
    return false;
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();

    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      handler,
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        type: 'https://nexaerp.dev/problems/auth-required',
        title: 'Authentication Required',
        status: 401,
        code: 'AUTH_REQUIRED',
        instance: request.url,
        detail: 'Bearer token is required',
      });
    }

    const token = authHeader.slice(7);
    const secret = this.config.supabaseJwtSecret;

    if (!secret) {
      throw new UnauthorizedException({
        type: 'https://nexaerp.dev/problems/internal',
        title: 'Internal Server Error',
        status: 500,
        code: 'INTERNAL',
        instance: request.url,
        detail: 'JWT verification not configured',
      });
    }

    if (!verifyJwtSignature(token, secret as string)) {
      throw new UnauthorizedException({
        type: 'https://nexaerp.dev/problems/auth-required',
        title: 'Authentication Required',
        status: 401,
        code: 'AUTH_REQUIRED',
        instance: request.url,
        detail: 'Invalid token signature',
      });
    }

    const payload = parseJwt(token);
    if (!payload) {
      throw new UnauthorizedException({
        type: 'https://nexaerp.dev/problems/auth-required',
        title: 'Authentication Required',
        status: 401,
        code: 'AUTH_REQUIRED',
        instance: request.url,
        detail: 'Invalid token format',
      });
    }

    if (payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedException({
        type: 'https://nexaerp.dev/problems/auth-required',
        title: 'Authentication Required',
        status: 401,
        code: 'AUTH_REQUIRED',
        instance: request.url,
        detail: 'Token has expired',
      });
    }

    const supabaseUrl = this.config.supabaseUrl;
    const expectedIssuer = supabaseUrl ? `${supabaseUrl}/auth/v1` : 'supabase';
    if (payload.iss !== expectedIssuer) {
      throw new UnauthorizedException({
        type: 'https://nexaerp.dev/problems/auth-required',
        title: 'Authentication Required',
        status: 401,
        code: 'AUTH_REQUIRED',
        instance: request.url,
        detail: 'Invalid token issuer',
      });
    }

    const user = await this.ensureUser(payload.sub, payload.email, payload.role);

    request.user = {
      id: user.id,
      authUserId: user.authUserId,
      email: user.email,
      name: user.name,
    };

    return true;
  }

  private async ensureUser(authUserId: string, email: string, name?: string) {
    let user = await this.prisma.user.findUnique({
      where: { authUserId },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          authUserId,
          email,
          name: name ?? email.split('@')[0],
        },
      });
    }

    return user;
  }
}

export { type JwtPayload, parseJwt, verifyJwtSignature };
