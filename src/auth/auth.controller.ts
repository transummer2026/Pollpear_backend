import {
  Body,
  Controller,
  Post,
  Get,
  HttpCode,
  Query,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  LoginSchema,
  RegisterSchema,
  PasswordForgotSchema,
  PasswordResetSchema,
  OauthCompleteSchema,
  type RegisterDTO,
  type LoginDTO,
  type PasswordForgotDTO,
  type PasswordResetDTO,
  type OauthCompleteSchemaDTO,
} from 'Pollpear_shared/src/schemas/auth.schema';
import { AuthService } from './auth.service';
import { type Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { OauthGuard } from './oauth.guard';
import { OauthExceptionFilter } from 'src/common/filters/oauth-exception.filter';
import { UserDTOSchema } from 'Pollpear_shared/src/schemas/users.schema';
import { OauthService, type OauthLoginResult } from './oauth.service';
import { type Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: OauthService,
  ) {} // ← closes here with {}

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
  @HttpCode(204)
  logout() {
    return this.authService.logout();
  }

  @Public()
  @Post('password-forgot')
  @HttpCode(204)
  passwordForgot(
    @Body(new ZodValidationPipe(PasswordForgotSchema)) body: PasswordForgotDTO,
  ) {
    return this.authService.passwordForgot(body);
  }

  @Public()
  @Post('password-reset')
  @HttpCode(204)
  passwordReset(
    @Body(new ZodValidationPipe(PasswordResetSchema)) body: PasswordResetDTO,
  ) {
    return this.authService.passwordReset(body);
  }

  // extracts a value from the URL route parameter named provider
  // if it was oauth/google, provider = google
  //provider: string receives
  @Public()
  @Get('oauth/pending')
  pending(@Query('token') token: string) {
    return this.oauthService.getPendingProfile(token);
  }

  @Public()
  @Post('oauth/complete')
  async complete(
    @Body(new ZodValidationPipe(OauthCompleteSchema))
    body: OauthCompleteSchemaDTO,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.oauthService.completeSignup(body);
    await this.authService.oauthLogin(user.id, res);
    return UserDTOSchema.parse(user);
  }

  @Public()
  @Get('oauth/:provider')
  @UseGuards(OauthGuard)
  @UseFilters(OauthExceptionFilter)
  oauth() {}

  @Public()
  @Get('oauth/:provider/callback')
  @UseGuards(OauthGuard)
  @UseFilters(OauthExceptionFilter)
  async callback(
    @Req() req: Request & { user?: OauthLoginResult },
    @Res() res: Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const result = req.user;
    if (result?.status === 'pending') {
      return res.redirect(
        `${frontendUrl}/auth/complete-profile?signup=${result.token}`,
      );
    }
    if (result?.status === 'user') {
      await this.authService.oauthLogin(result.user.id, res);
    }
    return res.redirect(frontendUrl);
  }
}
