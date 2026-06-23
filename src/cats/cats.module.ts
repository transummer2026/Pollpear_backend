import { Module } from '@nestjs/common';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';

@Module({
	controllers: [CatsController],
	providers: [CatsService],
})
export class CatsModule {}


// import { Module } from '@nestjs/common';
import { CatsService } from './cats.service';

// @Module({})
// export class CatsModule {}