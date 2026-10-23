import { SubmissionLocation } from './question.entity';
import { AgriEntityStatus, AgriEntityType } from '../../classes/enums';

/** An alternate name for a crop, weed, pest or disease together with its reference. */
export interface AgriEntityAlternateName {
  name: string;
  source: string;
}

/**
 * A user-submitted crop, weed, pest or disease record.
 * Image URLs are persisted as private `gs://` storage URIs.
 */
export class AgriEntity {
  id: string;
  userId: string;
  type: AgriEntityType;
  localName: string;
  englishName: string;
  botanicalName: string;
  /** Reference supporting that the local name maps to the standard name. */
  localNameSource: string;
  alternateNames: AgriEntityAlternateName[];
  imageUrls: string[];
  status: AgriEntityStatus;
  /** Where and when the entity was submitted. Missing on older records. */
  submissionLocation?: SubmissionLocation | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
