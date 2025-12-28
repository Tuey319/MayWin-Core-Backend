// src/core/unit-config/coverage-rules/dto/replace-coverage-rules.dto.ts
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CoverageRuleItemDto } from './coverage-rule-item.dto';

export class ReplaceCoverageRulesDto {
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => CoverageRuleItemDto)
  items!: CoverageRuleItemDto[];
}
