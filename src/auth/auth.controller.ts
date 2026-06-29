import { Controller, Post, Get, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
//import { CreateUserDto } from 'src/users/dto/create-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {} // ← closes here with {}

  @Post('login')
  login() {
    return this.authService.login();
  }

  @Post('logout')
  logout() {
    return this.authService.logout();
  }

  @Post('register')
  // TODO: add the userdto or see with pieric with the zod
  register() {
    return this.authService.register();
  }

  @Post('password-forgot')
  passwordForgot() {
    return this.authService.passwordForgot();
  }

  @Post('password-reset')
  passwordReset() {
    // redirect to /auth/login
    return this.authService.passwordReset();
  }

  @Get('oauth/:provider')
  oauth(@Param('provider') provider: string) {
    return this.authService.oauth(provider);
  }
}
