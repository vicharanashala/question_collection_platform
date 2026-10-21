import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

/** Query parameter holding user ids, comma separated or repeated. Used by the Super Admin user filter. */
export const UserIdsQuery = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) =>
      (Array.isArray(value) ? value : String(value).split(',')).map((id: string) => id.trim()).filter(Boolean),
    ),
    IsArray(),
    ArrayMaxSize(200),
    IsString({ each: true }),
  );
