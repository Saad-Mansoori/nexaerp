import { Controller, Get } from '@nestjs/common';

import { AuthService } from '../services/auth.service.js';
import { CurrentUser } from '@nexaerp/api/core/auth/auth.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  async me(@CurrentUser() user: { id: string }) {
    return this.authService.getMe(user.id);
  }
}
