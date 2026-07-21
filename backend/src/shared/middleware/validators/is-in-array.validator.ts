import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

/**
 * Validates that the property value is one of the allowed values passed as a static array.
 * Unlike class-validator's built-in @IsIn (which requires a const object), this works with
 * plain string arrays defined at runtime.
 */
export function IsInArray(allowedValues: string[], validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isInArray',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return allowedValues.includes(value as string);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be one of: ${allowedValues.join(', ')}`;
        },
      },
    });
  };
}