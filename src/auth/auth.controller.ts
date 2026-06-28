import { Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}  // ← closes here with {}
  @Post('login')
  login() {
    return this.authService.login();
  }
}
