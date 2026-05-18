export class WorkerResponseDto {
  id: string | number;
  fullName: string;
  employmentType: string | null;
  averageSatisfaction: number | null;
}

export class WorkerAdminResponseDto extends WorkerResponseDto {
  geminiConsentGiven: boolean;
  geminiConsentGivenAt: string | null;
  geminiConsentDeclinedAt: string | null;
}
