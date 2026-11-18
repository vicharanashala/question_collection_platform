import { FaqCategory } from '../../classes/enums';

export interface Faq {
  id: string;

  question: string;

  answer: string;

  category: FaqCategory;

  isVisible: boolean;

  displayOrder: number;

  createdAt: Date;

  updatedAt: Date;
}