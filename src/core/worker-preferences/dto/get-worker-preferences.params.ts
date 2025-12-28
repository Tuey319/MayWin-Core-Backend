// src/core/worker-preferences/dto/get-worker-preferences.params.ts
import { Matches } from 'class-validator';

export class GetWorkerPreferencesParams {
  // workers.id is bigint; keep numeric string over API
  @Matches(/^\d+$/)
  workerId!: string;
}
