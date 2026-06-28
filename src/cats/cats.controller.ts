import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CreateCatDto } from './dto/create-cat.dto';
import { CatsService } from './cats.service';
import { Cat } from './interfaces/cat.interface';

/**
 * The key idea behind a provider is that it can be injected as a dependency, allowing objects to
 * form various relationships with each other.
 * Controllers should handle HTTP requests and delegate more complex tasks to providers.
 * Providers are plain JavaScript classes declared as providers in a NestJS module (see modules)
 * For example, the CatsControler will call the Catservice service which is a provider
 * CatsService's role will be to manage the application's logic and is thus a provider
 * Here, the catservice is injected through the class constructor and Nest builds it
 * The service needs to be registered in module to add the
 * service to the providers array (see app.module.ts)
 */
@Controller('cats')
export class CatsController {
  constructor(private catsService: CatsService) {}

  @Post()
  create(@Body() createCatDto: CreateCatDto) {
    this.catsService.create(createCatDto); // here the dependency Catservices
    return 'This action adds a new cat';
    // is injected (created in the constructor) or the intance in the case of a singleton
  }

  @Get()
  findAll(@Query('age') age: number, @Query('breed') breed: string) {
    console.log('entered the get request for query');
    return `This action returns all cats filtered by age: ${age} and breed: ${breed}`;
  }
}
