import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisplaySettings } from '@/database/entities/users/display-settings.entity';
import { DisplaySettingsController } from './display-settings.controller';
import { DisplaySettingsService } from './display-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([DisplaySettings])],
  controllers: [DisplaySettingsController],
  providers: [DisplaySettingsService],
})
export class DisplaySettingsModule {}
