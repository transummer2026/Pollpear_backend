import { Controller, Post, Body } from '@nestjs/common';
import { ContactService } from './contact.service';

/**
 * ContactController(ContactService* injectedService)
 * : contactService(injectedService) {}
 * 
 * since we are not using a formal DTO class yet, we get the incoming payload
 * type as any so we can still pass down the received data inside the db
 */
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {} // equivalent to ContactService* const contactService;

  // here will need to use await to call the INSERT method
  // @Post()
  //   async create(@Body() body : any): Promise<any>  {
  //     try {
  //       const result = await this.contactService.create(body);
  //       return result;
  //     } catch (error) {
  //   return { result };
  // }
}