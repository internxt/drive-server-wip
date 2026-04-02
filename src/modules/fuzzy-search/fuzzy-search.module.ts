import { Module } from '@nestjs/common';
import { SequelizeLookUpRepository } from './look-up.repository';
import { FuzzySearchUseCases } from './fuzzy-search.usecase';
import { FuzzySearchController } from './fuzzy-search.controller';

@Module({
  controllers: [FuzzySearchController],
  providers: [SequelizeLookUpRepository, FuzzySearchUseCases],
  exports: [FuzzySearchUseCases, SequelizeLookUpRepository],
})
export class FuzzySearchModule {}
