import { IsBoolean } from 'class-validator';

export class ToggleVisibilityDto {
  @IsBoolean()
  isVisible: boolean;
}