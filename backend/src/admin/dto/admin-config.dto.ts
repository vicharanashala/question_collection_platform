import {
  IsString,
  IsNumber,
  IsOptional,
  Validate,
  ValidatorConstraint,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { Type } from 'class-transformer';

export const MIN_SIMILARITY = 0.0;
export const MAX_SIMILARITY = 1.0;

/**
 * Validates the `value` field based on the `key` field:
 *   - duplicate_similarity_threshold → value must be in [0, 1]
 *   - everything else                → value must be >= 0
 */
@ValidatorConstraint({ name: 'configValueRange', async: false })
export class ConfigValueRangeConstraint {
  validate(value: number, args: ValidationArguments): boolean {
    // args.object is the plain DTO object (before transformation)
    const key = (args.object as Record<string, unknown>)['key'] as string | undefined;
    if (key === 'duplicate_similarity_threshold') {
      return typeof value === 'number' && value >= MIN_SIMILARITY && value <= MAX_SIMILARITY;
    }
    // Default: any non-negative number
    return typeof value === 'number' && value >= 0;
  }

  defaultMessage(args: ValidationArguments): string {
    const key = (args.object as Record<string, unknown>)['key'] as string | undefined;
    if (key === 'duplicate_similarity_threshold') {
      return `value must be a number between ${MIN_SIMILARITY} and ${MAX_SIMILARITY} (inclusive) for key '${key}'`;
    }
    return 'value must be a non-negative number';
  }
}

// ── Update Config ─────────────────────────────────────────────────────────────────

export class UpdateConfigDto {
  @IsString()
  key: string;

  @IsNumber()
  @Type(() => Number)
  @Validate(ConfigValueRangeConstraint)
  value: number;

  @IsOptional()
  @IsString()
  description?: string;
}

// ── Create Config ─────────────────────────────────────────────────────────────────

export class CreateConfigDto {
  @IsString()
  key: string;

  @IsNumber()
  @Type(() => Number)
  @Validate(ConfigValueRangeConstraint)
  value: number;

  @IsOptional()
  @IsString()
  description?: string;
}