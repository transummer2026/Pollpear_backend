import { Controller, Post, Get, Param, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
//import { CreateUserDto } from 'src/users/dto/create-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {} // ← closes here with {}

  @Post('login')
  @HttpCode(503)
  login() {
    return this.authService.login();
  }

  @Post('logout')
  @HttpCode(503)
  logout() {
    return this.authService.logout();
  }

  @Post('register')
  @HttpCode(503)
  // TODO: add the userdto or see with pieric with the zod
  register() {
    return this.authService.register();
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
