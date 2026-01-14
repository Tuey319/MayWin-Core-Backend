// src/core/orchestrator/orchestrator.module.ts
import { Module } from '@nestjs/common';
import { JobsModule } from '@/core/jobs/jobs.module';
import { OrchestratorController } from './orchestrator.controller';

@Module({
  imports: [JobsModule],
  controllers: [OrchestratorController],
})
export class OrchestratorModule {}
