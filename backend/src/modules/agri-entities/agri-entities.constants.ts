import { AgriEntityType } from '../../shared/classes/enums';

export const MAX_AGRI_ENTITY_IMAGES = 5;
export const MAX_AGRI_ENTITY_IMAGE_SIZE_MB = 5;
export const MAX_AGRI_ENTITY_ALTERNATE_NAMES = 20;
export const MAX_AGRI_ENTITY_NAME_LENGTH = 200;
export const MAX_AGRI_ENTITY_SOURCE_LENGTH = 500;

// Storage folder per type, e.g. "agri-entities/crops". Objects land under
// {env-prefix}/agri-entities/{type}s/{userId}/{yyyy-MM}/{uuid}_{filename}.
const AGRI_ENTITY_STORAGE_ROOT = 'agri-entities';

// Returns the storage category (folder) used for images of the given type.
export function getAgriEntityImageCategory(type: AgriEntityType): string {
  return `${AGRI_ENTITY_STORAGE_ROOT}/${type}s`;
}
