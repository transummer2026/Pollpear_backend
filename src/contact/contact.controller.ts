import { Controller, Post, HttpCode } from '@nestjs/common';
import { ContactService } from './contact.service';

/**
 * Placeholder for the contact form: the route is declared so the path is
 * reserved and documented, and answers 503 until the service is written.
 */
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @HttpCode(503)
  contact() {
    return this.contactService.contact();
  }
}
