import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  HttpCode,
  Res,
} from '@nestjs/common';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  LoginSchema,
  RegisterSchema,
  type RegisterDTO,
  type LoginDTO,
} from 'Pollpear_shared/src/schemas/auth.schema';
import { AuthService } from './auth.service';
import { type Response } from 'express';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {} // ← closes here with {}

  @Public()
  @Post('register')
  register(@Body(new ZodValidationPipe(RegisterSchema)) body: RegisterDTO) {
    return this.authService.register(body);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginDTO,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(body, res);
  }

  @Post('logout')
  @HttpCode(503)
  logout() {
    return this.authService.logout();
  }

  @Post('password-forgot')
  @HttpCode(503)
  passwordForgot() {
    return this.authService.passwordForgot();
  }

  @Post('password-reset')
  @HttpCode(503)
  passwordReset() {
    // redirect to /auth/login
    return this.authService.passwordReset();
  }

  // extracts a value from the URL route parameter named provider
  // if it was oauth/google, provider = google
  //provider: string receives
  @Get('oauth/:provider')
  @HttpCode(503)
  oauth(@Param('provider') provider: string) {
    return this.authService.oauth(provider);
  }

  @Get('oauth/:provider/callback')
  @HttpCode(503)
  callback() {
    return this.authService.callback();
  }
}
