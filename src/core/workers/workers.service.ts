// src/core/workers/workers.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

import { Worker } from '@/database/entities/workers/worker.entity';
import { WorkerPreference } from '@/database/entities/workers/worker-preference.entity';
import { PutWorkerPreferencesDto } from './dto/put-preferences.dto';

@Injectable()
export class WorkersService {
  constructor(
    @InjectRepository(Worker) private readonly workersRepo: Repository<Worker>,
    @InjectRepository(WorkerPreference) private readonly prefsRepo: Repository<WorkerPreference>,
  ) {}

  async listWorkers(unitId: string, search: string | null) {
    const where: any = { primary_unit_id: unitId, is_active: true };

    if (search) {
      where.full_name = ILike(`%${search}%`);
    }

    const workers = await this.workersRepo.find({ where, order: { full_name: 'ASC' } });

    return {
      workers: workers.map((w) => ({
        id: w.id,
        fullName: w.full_name,
        employmentType: w.employment_type,
      })),
    };
  }

  async upsertPreferences(workerId: string, dto: PutWorkerPreferencesDto) {
    const worker = await this.workersRepo.findOne({ where: { id: workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    let pref = await this.prefsRepo.findOne({ where: { worker_id: workerId } });

    if (!pref) {
      pref = this.prefsRepo.create({
        worker_id: workerId,
        prefers_day_shifts: dto.prefersDayShifts ?? null,
        prefers_night_shifts: dto.prefersNightShifts ?? null,
        max_consecutive_work_days: dto.maxConsecutiveWorkDays ?? null,
        max_consecutive_night_shifts: dto.maxConsecutiveNightShifts ?? null,
        preference_pattern_json: dto.preferencePatternJson ?? {},
        attributes: dto.attributes ?? {},
      });
    } else {
      pref.prefers_day_shifts = dto.prefersDayShifts ?? pref.prefers_day_shifts;
      pref.prefers_night_shifts = dto.prefersNightShifts ?? pref.prefers_night_shifts;
      pref.max_consecutive_work_days = dto.maxConsecutiveWorkDays ?? pref.max_consecutive_work_days;
      pref.max_consecutive_night_shifts = dto.maxConsecutiveNightShifts ?? pref.max_consecutive_night_shifts;
      pref.preference_pattern_json = dto.preferencePatternJson ?? pref.preference_pattern_json;
      pref.attributes = dto.attributes ?? pref.attributes;
    }

    const saved = await this.prefsRepo.save(pref);

    return {
      workerId,
      updatedAt: saved.updated_at?.toISOString?.() ?? new Date().toISOString(),
    };
  }
}
