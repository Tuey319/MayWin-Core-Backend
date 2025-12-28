// src/core/worker-preferences/worker-preferences.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Worker } from '@/database/entities/workers/worker.entity';
import { WorkerPreferencesDto } from './dto/put-worker-preferences.dto';

type PreferencesStore = {
  preferencesByUnit?: Record<string, WorkerPreferencesDto>;
};

@Injectable()
export class WorkerPreferencesService {
  constructor(
    @InjectRepository(Worker)
    private readonly workersRepo: Repository<Worker>,
  ) {}

  async getPreferences(workerId: string) {
    const worker = await this.workersRepo.findOne({ where: { id: workerId } });
    if (!worker || !worker.is_active) throw new NotFoundException('Worker not found');

    const attrs = (worker.attributes ?? {}) as Record<string, any>;
    const store: PreferencesStore = (attrs.preferences ?? {}) as PreferencesStore;

    return {
      workerId: worker.id,
      preferences: store.preferencesByUnit ?? {},
    };
  }

  async upsertPreferences(workerId: string, unitId: string, preferences: WorkerPreferencesDto) {
    const worker = await this.workersRepo.findOne({ where: { id: workerId } });
    if (!worker || !worker.is_active) throw new NotFoundException('Worker not found');

    const attrs = (worker.attributes ?? {}) as Record<string, any>;

    const currentPrefRoot: any = attrs.preferences ?? {};
    const currentByUnit: Record<string, WorkerPreferencesDto> =
      currentPrefRoot.preferencesByUnit ?? {};

    // Merge: replace the unit preferences as a whole (clean + predictable)
    const nextByUnit = {
      ...currentByUnit,
      [unitId]: preferences,
    };

    worker.attributes = {
      ...attrs,
      preferences: {
        ...currentPrefRoot,
        preferencesByUnit: nextByUnit,
      },
    };

    const saved = await this.workersRepo.save(worker);

    return {
      workerId: saved.id,
      unitId,
      preferences: nextByUnit[unitId],
      updatedAt: saved.updated_at.toISOString(),
    };
  }
}
