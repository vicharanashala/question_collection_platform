import { Inject, Injectable } from '@nestjs/common';
import {
  IAgriEntityRepository,
  IQuestionRepository,
  REPOSITORY_TOKENS,
} from '../../shared/database/repositories';
import { AgriEntityType } from '../../shared/classes/enums';
import {
  type AnveshanProgress,
  evaluateAnveshanProgress,
  getAnveshanRequirements,
} from '../../shared/utils/anveshan.util';

const AGRI_TYPE_KEYS: Record<AgriEntityType, 'crop' | 'weed' | 'pest' | 'disease'> = {
  [AgriEntityType.CROP]: 'crop',
  [AgriEntityType.WEED]: 'weed',
  [AgriEntityType.PEST]: 'pest',
  [AgriEntityType.DISEASE]: 'disease',
};

// Computes Anveshan milestone progress for many users at once, for the admin user list.
@Injectable()
export class AnveshanProgressService {
  constructor(
    @Inject(REPOSITORY_TOKENS.Question)
    private readonly questionRepo: IQuestionRepository,
    @Inject(REPOSITORY_TOKENS.AgriEntity)
    private readonly agriEntityRepo: IAgriEntityRepository,
  ) {}

  // Progress for each given user, using two grouped queries regardless of how many users are passed.
  async getProgressForUsers(userIds: string[]): Promise<Map<string, AnveshanProgress>> {
    const result = new Map<string, AnveshanProgress>();
    if (userIds.length === 0) return result;

    const [questionCounts, agriCounts] = await Promise.all([
      this.questionRepo.countSubmissionsByUsers(userIds),
      this.agriEntityRepo.countByUsersAndType(userIds),
    ]);

    const counts = new Map(
      userIds.map((id) => [id, { questions: 0, crop: 0, weed: 0, pest: 0, disease: 0, answers: 0 }]),
    );
    for (const row of questionCounts) {
      const entry = counts.get(row.userId);
      if (entry) Object.assign(entry, { questions: row.questions, answers: row.answers });
    }
    for (const row of agriCounts) {
      const entry = counts.get(row.userId);
      const key = AGRI_TYPE_KEYS[row.type];
      if (entry && key) entry[key] = row.count;
    }

    for (const [id, entry] of counts) result.set(id, evaluateAnveshanProgress(entry));
    return result;
  }

  // Ids of users who reached 100%. Only users with enough answers can qualify, which keeps the candidate set small.
  async findCompletedUserIds(): Promise<string[]> {
    const candidates = await this.questionRepo.findUserIdsWithAnswers(getAnveshanRequirements().answers);
    const progress = await this.getProgressForUsers(candidates);
    return candidates.filter((id) => progress.get(id)?.completed);
  }
}
