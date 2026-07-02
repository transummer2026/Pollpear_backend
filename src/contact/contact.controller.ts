import { Controller, Post, HttpCode } from '@nestjs/common';
import { ContactService } from './contact.service';

/**
 * ContactController(ContactService* injectedService)
 * : contactService(injectedService) {}
 * since we are not using a formal DTO class yet, we get the incoming payload
 * type as any so we can still pass down the received data inside the db
 */
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {} // equivalent to ContactService* const contactService;

  @Post()
  @HttpCode(503)
  contact() {
    return this.contactService.contact();
  }
}
