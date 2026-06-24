import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  create(createContactDto: CreateContactDto) {}

  findAll() {}

  findOne(id: string) {}

  update(id: string, updateContactDto: Partial<CreateContactDto>) {}

  remove(id: string) {}
}
