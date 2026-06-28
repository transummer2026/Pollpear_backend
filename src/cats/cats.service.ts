import { Injectable } from '@nestjs/common';
import { Cat } from './interfaces/cat.interface';

/**
 * the Injectable decorator attaches metadata to the class,
 * indicating that CatService is a class that can
 * be managed by the NestJs IoC container.
 * This example makes the use of a cat interface to create
 * an array of classes.
 */
@Injectable()
export class CatsService {
  private readonly cats: Cat[] = []; // readonly means you can add but not assign

  create(cat: Cat) {
    this.cats.push(cat);
  }

  findAll(): Cat[] {
    return this.cats;
  }
}
