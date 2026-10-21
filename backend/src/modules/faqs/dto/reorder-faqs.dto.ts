import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsString } from 'class-validator';

export class ReorderFaqsDto {
  // FAQ ids in their new order. Only the FAQs being rearranged need to be sent.
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsString({ each: true })
  ids: string[];
}
