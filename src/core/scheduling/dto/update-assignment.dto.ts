export class UpdateAssignmentDto {
  worker_id!: string;
  date!: string;       // YYYY-MM-DD (optional if you patch by id only; keep for validation if needed)
  shift_code!: string;
}
