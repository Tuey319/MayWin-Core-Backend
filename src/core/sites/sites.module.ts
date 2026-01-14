// src/core/sites/sites.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from '@/database/entities/core/site.entity';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';

@Module({
  imports: [TypeOrmModule.forFeature([Site])],
  controllers: [SitesController],
  providers: [SitesService],
})
export class SitesModule {}
