import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  login() {
    return 'login works';
  }

  logout() {
    return 'logout works';
  }

  register() {
    return 'register works';
  }

  passwordForgot() {
    return 'password forgot works';
  }

  passwordReset() {
    return 'password reset works';
  }

  oauth(provider: string) {
    return `Oath with ${provider}`;
  }
}
