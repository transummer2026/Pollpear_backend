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
import { UserId } from 'src/common/decorators/user-id.decorator';
import {
  LoginSchema,
  RegisterSchema,
  PasswordForgotSchema,
  PasswordResetSchema,
  VerifyEmailSchema,
  ResendVerificationSchema,
  type RegisterDTO,
  type LoginDTO,
  type PasswordForgotDTO,
  type PasswordResetDTO,
  type VerifyEmailDTO,
  type ResendVerificationDTO,
} from 'Pollpear_shared/src/schemas/auth.schema';
import {
  OauthCompleteSchema,
  type OauthCompleteDTO,
} from 'Pollpear_shared/src/schemas/oauth.schema';
import { AuthService } from './auth.service';
import { type Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { OauthGuard } from './oauth.guard';
import { OauthExceptionFilter } from 'src/common/filters/oauth-exception.filter';
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
  logout(@UserId() userId: number) {
    return this.authService.logout(userId);
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

  @Public()
  @Post('verify-email')
  @HttpCode(204)
  verifyEmail(
    @Body(new ZodValidationPipe(VerifyEmailSchema)) body: VerifyEmailDTO,
  ) {
    return this.authService.verifyEmail(body);
  }

  @Public()
  @Post('verify-email/resend')
  @HttpCode(204)
  resendVerification(
    @Body(new ZodValidationPipe(ResendVerificationSchema))
    body: ResendVerificationDTO,
  ) {
    return this.authService.resendVerification(body);
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
  complete(
    @Body(new ZodValidationPipe(OauthCompleteSchema)) body: OauthCompleteDTO,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.oauthService.completeSignupAndLogin(body, res);
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
    res.redirect(await this.oauthService.handleCallback(req.user, res));
  }
}
