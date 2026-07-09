// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import * as faker from "faker";
import * dotenv from "dotenv";

const prisma = new PrismaClient();

const fakerUser = () : any  => ({
  name: faker.name.firstName(sex),
  email: faker.internet.email(),
  password: faker.internet.password(),
  nationality: faker.address.country(),
  gender: faker.sex(),
  birthdate: faker.date.faker.date.betweens({ from: '1920-01-01T00:00:00.000Z', to: '2005-01-01T00:00:00.000Z' }),
});

async function main() {
	const fakerRounds = 100;
dotenv.config();
console.log('Seeding...');
for (let i = 0; i < fakerRounds; i++) {
await prisma.user.create({ data: fakerUser() });
}
};

  

main()
.catch((e) => console.error(e))
.finally(async () => {
await prisma.$disconnect();
});
