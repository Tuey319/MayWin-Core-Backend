import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportOptions } from '@/database/entities/users/export-options.entity';
import { ExportOptionsController } from './export-options.controller';
import { ExportOptionsService } from './export-options.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExportOptions])],
  controllers: [ExportOptionsController],
  providers: [ExportOptionsService],
})
export class ExportOptionsModule {}
