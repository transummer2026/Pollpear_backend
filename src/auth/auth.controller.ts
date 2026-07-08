import { Body, Controller, Post, Get, Param, HttpCode } from '@nestjs/common';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  LoginSchema,
  RegisterSchema,
  type RegisterDTO,
  type LoginDTO,
} from 'Pollpear_shared/src/schemas/auth.schema';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {} // ← closes here with {}

  @Post('login')
  @HttpCode(503)
  login(@Body(new ZodValidationPipe(LoginSchema)) body: LoginDTO) {
    return this.authService.login(body);
  }

  @Post('logout')
  @HttpCode(503)
  logout() {
    return this.authService.logout();
  }

  @Post('register')
  register(@Body(new ZodValidationPipe(RegisterSchema)) body: RegisterDTO) {
    return this.authService.register(body);
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
