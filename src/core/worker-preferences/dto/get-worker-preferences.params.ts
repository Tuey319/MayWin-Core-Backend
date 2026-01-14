// src/core/worker-preferences/dto/get-worker-preferences.params.ts
import { Matches } from 'class-validator';

export class GetWorkerPreferencesParams {
  @Matches(/^\d+$/)
  workerId!: string;
}
