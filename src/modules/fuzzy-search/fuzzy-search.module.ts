import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { LookUpModel } from './look-up.model';
import { SequelizeLookUpRepository } from './look-up.repository';
import { FuzzySearchUseCases } from './fuzzy-search.usecase';
import { FuzzySearchController } from './fuzzy-search.controller';

@Module({
  imports: [SequelizeModule.forFeature([LookUpModel])],
  controllers: [FuzzySearchController],
  providers: [
    {
      provide: 'Look_Up_Repository',
      useValue: new SequelizeLookUpRepository(LookUpModel),
    },
    FuzzySearchUseCases,
  ],
  exports: [FuzzySearchUseCases],
})
export class FuzzySearchModule {}
