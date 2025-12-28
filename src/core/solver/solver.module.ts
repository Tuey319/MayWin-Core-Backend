// src/core/solver/solver.module.ts
import { Module } from '@nestjs/common';
import { SolverAdapter } from './solver.adapter';

@Module({
  providers: [SolverAdapter],
  exports: [SolverAdapter],
})
export class SolverModule {}
