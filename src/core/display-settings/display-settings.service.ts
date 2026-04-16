import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DisplaySettings } from '@/database/entities/users/display-settings.entity';

@Injectable()
export class DisplaySettingsService {
  constructor(
    @InjectRepository(DisplaySettings)
    private readonly repo: Repository<DisplaySettings>,
  ) {}

  async get(userId: string): Promise<Record<string, any>> {
    const row = await this.repo.findOne({ where: { user_id: userId } });
    return row?.settings ?? {};
  }

  async upsert(userId: string, settings: Record<string, any>): Promise<Record<string, any>> {
    let row = await this.repo.findOne({ where: { user_id: userId } });
    if (row) {
      row.settings = settings;
    } else {
      row = this.repo.create({ user_id: userId, settings });
    }
    await this.repo.save(row);
    return row.settings;
  }
}
