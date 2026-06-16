import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { INestApplication } from '@nestjs/common';
import { AdminService } from '../../admin/admin.service';

declare global {
  // eslint-disable-next-line no-var
  var nestApp: INestApplication | undefined;
}

/**
 * Validates that a string (questionText) does not exceed the
 * `max_question_chars` value stored in the admin_config table.
 *
 * class-validator instantiates this outside NestJS's DI container,
 * so we resolve AdminService via app.get() inside validate().
 */
@ValidatorConstraint({ name: 'maxQuestionChars', async: true })
export class MaxQuestionCharsConstraint implements ValidatorConstraintInterface {
  async validate(text: string, _args: ValidationArguments): Promise<boolean> {
    if (text == null || typeof text !== 'string') return true; // let @IsNotEmpty handle null
    try {
      const app = globalThis.nestApp;
      if (!app) return text.length <= 1000; // fallback
      const adminService = app.get(AdminService, { strict: false });
      const maxChars = await adminService.getConfigValue('max_question_chars');
      return text.length <= maxChars;
    } catch {
      return text.length <= 1000;
    }
  }

  defaultMessage(_args: ValidationArguments): string {
    return `Question text exceeds the maximum allowed length (configured in system settings)`;
  }
}

/**
 * Decorator: validates string length against `max_question_chars` admin config.
 * Pass `propertyName` to target a specific field; leave empty for the decorated field.
 */
export function MaxQuestionChars(
  validationOptions?: ValidationOptions & { propertyName?: string },
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor as Function,
      propertyName: validationOptions?.propertyName ?? propertyName,
      options: validationOptions,
      constraints: [],
      validator: MaxQuestionCharsConstraint,
    });
  };
}