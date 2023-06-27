import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { LookUpModel } from './look-up.model';
import { SequelizeLookUpRepository } from './look-up.repository';
import { FuzzySearchUseCases } from './fuzzy-search.usecase';

@Module({
  imports: [SequelizeModule.forFeature([LookUpModel])],
  controllers: [],
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
