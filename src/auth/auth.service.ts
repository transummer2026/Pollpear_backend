import { Injectable } from '@nestjs/common';
import { type RegisterDTO } from '../../Pollpear_shared/src/schemas/auth.schema';

@Injectable()
export class AuthService {
  login() {
    return 'login route works';
  }

  logout() {
    return 'logout route works';
  }

  register(body: RegisterDTO) {
    console.log(body); // json
    return 'register route works';
  }

  passwordForgot() {
    return 'password forgot route works';
  }

  passwordReset() {
    return 'password reset route works';
  }

  oauth(provider: string) {
    // redirection to the provider happens here
    return `Oauth with ${provider} works`;
  }

  callback() {
    return 'callback route works';
  }
}
