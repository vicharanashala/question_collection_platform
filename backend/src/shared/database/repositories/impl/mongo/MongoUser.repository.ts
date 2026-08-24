import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { MongoRepository } from "../../../abstractions/mongo.repository";
import { IUserRepository } from "../../IUser.repository";
import { User } from "../../../entities";
import { Question } from "../../../entities";
import { Wallet } from "../../../entities";
import { QuestionStatus, UserCategory } from "../../../../classes/enums";
import type { LeaderboardEntry } from "../../IUser.repository";
import { UserRole } from "../../../../classes/enums";
import {
  TransactionSource,
  TransactionType,
  TransactionStatus,
} from "../../../../classes/enums";

@Injectable()
export class MongoUserRepository
  extends MongoRepository<User>
  implements IUserRepository
{
  constructor(
    @InjectModel("User") protected readonly _model: Model<User>,
    @InjectModel("Question") private readonly _questionModel: Model<Question>,
    @InjectModel("Wallet") private readonly _walletModel: Model<Wallet>,
  ) {
    super(_model);
  }

  async findByMobile(mobileNumber: string): Promise<User | null> {
    return this._model
      .findOne({ mobileNumber } as Record<string, unknown>)
      .exec() as Promise<User | null>;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this._model
      .findOne({ username } as Record<string, unknown>)
      .exec() as Promise<User | null>;
  }

  /**
   * Bulk lookup users by ObjectId hex strings. Invalid ids (not 24 chars, or
   * not parseable as ObjectId) are filtered out before the query so the
   * `$in` doesn't throw. Returns only `id / name / username` — enough for
   * list-table display enrichment without pulling the whole user document
   * (sensitive fields, otpHash, profileData, etc.).
   *
   * Accepts a mixed array of strings and `Types.ObjectId` instances; each
   * value is coerced to its 24-char hex representation before the query so
   * callers don't have to pre-normalize.
   */
  async findByIds(
    ids: ReadonlyArray<string | Types.ObjectId | null | undefined>,
  ): Promise<Array<{ id: string; name: string; username: string | null }>> {
    const validIds = (ids ?? [])
      .map((id) =>
        id == null ? null : typeof id === "string" ? id : String(id),
      )
      .filter(
        (id): id is string =>
          typeof id === "string" &&
          id.length === 24 &&
          Types.ObjectId.isValid(id),
      )
      .map((id) => new Types.ObjectId(id));

    if (validIds.length === 0) return [];

    const docs = await this._model
      .find(
        { _id: { $in: validIds } } as Record<string, unknown>,
        { _id: 1, name: 1, username: 1 } as Record<string, unknown>,
      )
      .exec();

    return docs.map((d) => {
      const raw = d as unknown as Record<string, unknown>;
      return {
        id: String(raw._id),
        name: (raw.name as string) ?? "",
        username: (raw.username as string | null) ?? null,
      };
    });
  }

  async updateOtpHash(mobileNumber: string, hash: string): Promise<void> {
    await this._model
      .updateOne({ mobileNumber } as Record<string, unknown>, {
        $set: { otpHash: hash },
      })
      .exec();
  }

  async clearOtpHash(mobileNumber: string): Promise<void> {
    await this._model
      .updateOne({ mobileNumber } as Record<string, unknown>, {
        $unset: { otpHash: 1 },
      })
      .exec();
  }

  async findWithWallet(
    userId: string,
  ): Promise<(User & { wallet?: unknown }) | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    const user = await this._model.findById(userId).exec();
    if (!user) return null;

    const wallet = await this._walletModel
      .findOne({ userId } as Record<string, unknown>)
      .exec();

    const u = user as unknown as Record<string, unknown>;
    const result = {
      ...u,
      id: String(u._id),
      _id: undefined,
      wallet: wallet ?? undefined,
    };
    return result as unknown as User & { wallet?: unknown };
  }

  // async getLeaderboard(opts: {
  //   limit?: number;
  //   skip?: number;
  //   state?: string;
  //   category?: UserCategory;
  // }): Promise<LeaderboardEntry[]> {
  //   const { limit = 20, skip = 0, state, category } = opts;

  //   // Build user-set filter (state and/or category)
  //   const userFilter: Record<string, unknown> = {};
  //   if (state) userFilter.state = state;
  //   if (category) userFilter.category = category;

  //   // Step 1: resolve eligible user IDs (avoids running aggregation over the entire collection)
  //   let eligibleUserIds: string[] | null = null;
  //   if (Object.keys(userFilter).length > 0) {
  //     const eligibleUsers = await this._model
  //       .find(userFilter as Record<string, unknown>, { _id: 1 } as Record<string, unknown>)
  //       .exec();
  //     eligibleUserIds = eligibleUsers.map((u) => String((u as unknown as Record<string, unknown>)._id));
  //     if (eligibleUserIds.length === 0) return []; // no matching users — empty leaderboard
  //   }

  //   // Step 2: count approved questions per user, ranked correctly
  //   const matchStage: Record<string, unknown> = { status: QuestionStatus.APPROVED };
  //   if (eligibleUserIds !== null) matchStage.userId = { $in: eligibleUserIds };

  //   const rankedCounts = await this._questionModel
  //     .aggregate([
  //       { $match: matchStage },
  //       { $group: { _id: '$userId', approvedCount: { $sum: 1 } } },
  //       { $sort: { approvedCount: -1 } },
  //       { $skip: skip },
  //       { $limit: limit },
  //     ])
  //     .exec();

  //   if (rankedCounts.length === 0) return [];

  //   // Step 3: hydrate user details for the ranked user IDs
  //   const rankedUserIds = rankedCounts.map((r) => r._id as string);
  //   const userDocs = await this._model
  //     .find({ _id: { $in: rankedUserIds.map((id) => new Types.ObjectId(id)) } } as Record<string, unknown>)
  //     .exec();

  //   const userMap = new Map<string, Record<string, unknown>>();
  //   for (const doc of userDocs) {
  //     const d = doc as unknown as Record<string, unknown>;
  //     userMap.set(String(d._id), d);
  //   }

  //   // Step 4: assemble leaderboard entries preserving aggregation order
  //   const result: LeaderboardEntry[] = [];
  //   for (const row of rankedCounts) {
  //     const userId = row._id as string;
  //     const doc = userMap.get(userId);
  //     if (!doc) continue; // user deleted after aggregation
  //     result.push({
  //       id: userId,
  //       username: (doc.username as string | null) ?? null,
  //       name: doc.name as string,
  //       mobileNumber: doc.mobileNumber as string,
  //       profilePicUrl: (doc.profilePicUrl as string) ?? null,
  //       crops: (doc.crops as string[]) ?? [],
  //       approvedCount: row.approvedCount,
  //     });
  //   }

  //   return result;
  // }

  async getLeaderboard(opts: {
  limit: number;
  offset: number;
  state?: string;
  category?: UserCategory;
}): Promise<{
  entries: LeaderboardEntry[];
  total: number;
}> {
  const {
    limit,
    offset,
    state,
    category,
  } = opts;

  const userFilter: Record<string, unknown> = {
    role: UserRole.USER,
  };

  if (state) {
    userFilter.state = state;
  }

  if (category) {
    userFilter.category = category;
  }

  const result = await this._model.aggregate([
    // --------------------------------------------------
    // 1. Only eligible users
    // --------------------------------------------------
    {
      $match: userFilter,
    },

    // --------------------------------------------------
    // 2. Count approved questions
    // --------------------------------------------------
    {
      $lookup: {
        from: 'questions',
        let: {
          userId: {
            $toString: '$_id',
          },
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: [
                      '$userId',
                      '$$userId',
                    ],
                  },
                  {
                    $eq: [
                      '$status',
                      QuestionStatus.APPROVED,
                    ],
                  },
                ],
              },
            },
          },
          {
            $count: 'count',
          },
        ],
        as: 'questionStats',
      },
    },

    {
      $addFields: {
        totalQuestions: {
          $ifNull: [
            {
              $arrayElemAt: [
                '$questionStats.count',
                0,
              ],
            },
            0,
          ],
        },
      },
    },

    // --------------------------------------------------
    // 3. Find user's wallet
    // --------------------------------------------------
    {
      $lookup: {
        from: 'wallets',
        let: {
          userId: {
            $toString: '$_id',
          },
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: [
                  '$userId',
                  '$$userId',
                ],
              },
            },
          },
          {
            $project: {
              _id: 1,
            },
          },
        ],
        as: 'wallets',
      },
    },

    // --------------------------------------------------
    // 4. Find completed reward transactions
    // --------------------------------------------------
    {
      $lookup: {
        from: 'transactions',
        let: {
          walletIds: {
            $map: {
              input: '$wallets',
              as: 'wallet',
              in: {
                $toString: '$$wallet._id',
              },
            },
          },
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $in: [
                      '$walletId',
                      '$$walletIds',
                    ],
                  },
                  {
                    $eq: [
                      '$type',
                      TransactionType.CREDIT,
                    ],
                  },
                  {
                    $eq: [
                      '$source',
                      TransactionSource.REWARD,
                    ],
                  },
                  {
                    $eq: [
                      '$status',
                      TransactionStatus.COMPLETED,
                    ],
                  },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              total: {
                $sum: '$amount',
              },
            },
          },
        ],
        as: 'earnedStats',
      },
    },

    // --------------------------------------------------
    // 5. Calculate total earned
    // --------------------------------------------------
    {
      $addFields: {
        totalEarned: {
          $ifNull: [
            {
              $arrayElemAt: [
                '$earnedStats.total',
                0,
              ],
            },
            0,
          ],
        },
      },
    },

    // --------------------------------------------------
    // IMPORTANT:
    // DO NOT filter totalQuestions > 0 here.
    //
    // Leaderboard is based on money earned.
    // --------------------------------------------------

    // --------------------------------------------------
    // 6. Sort BEFORE pagination
    // --------------------------------------------------
    {
      $sort: {
        totalEarned: -1,
        totalQuestions: -1,
        _id: 1,
      },
    },

    // --------------------------------------------------
    // 7. Get total number of users
    // --------------------------------------------------
    {
      $facet: {
        entries: [
          {
            $skip: offset,
          },
          {
            $limit: limit,
          },
          {
            $project: {
              _id: 0,
              id: {
                $toString: '$_id',
              },
              name: 1,
              totalEarned: 1,
              totalQuestions: 1,
            },
          },
        ],

        total: [
          {
            $count: 'count',
          },
        ],
      },
    },
  ]).exec();

  const facetResult = result[0] ?? {
    entries: [],
    total: [],
  };

  const entries = (
    facetResult.entries ?? []
  ) as LeaderboardEntry[];

  const total =
    facetResult.total?.[0]?.count ?? 0;

  return {
    entries,
    total,
  };
}

  async getApprovedQuestionCount(userId: string): Promise<number> {
    const result = await this._questionModel
      .aggregate([
        { $match: { userId, status: QuestionStatus.APPROVED } },
        { $count: "approvedCount" },
      ])
      .exec();
    return result[0]?.approvedCount ?? 0;
  }

  async getLeaderboardRank(opts: {
  userId: string;
  state?: string;
  category?: UserCategory;
}): Promise<number | null> {
  const {
    userId,
    state,
    category,
  } = opts;

  const userFilter: Record<string, unknown> = {
    role: UserRole.USER,
  };

  if (state) {
    userFilter.state = state;
  }

  if (category) {
    userFilter.category = category;
  }

  const result = await this._model.aggregate([
    // --------------------------------------------------
    // 1. Eligible users
    // --------------------------------------------------
    {
      $match: userFilter,
    },

    // --------------------------------------------------
    // 2. Count approved questions
    // --------------------------------------------------
    {
      $lookup: {
        from: 'questions',
        let: {
          userId: {
            $toString: '$_id',
          },
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: [
                      '$userId',
                      '$$userId',
                    ],
                  },
                  {
                    $eq: [
                      '$status',
                      QuestionStatus.APPROVED,
                    ],
                  },
                ],
              },
            },
          },
          {
            $count: 'count',
          },
        ],
        as: 'questionStats',
      },
    },

    {
      $addFields: {
        totalQuestions: {
          $ifNull: [
            {
              $arrayElemAt: [
                '$questionStats.count',
                0,
              ],
            },
            0,
          ],
        },
      },
    },

    // --------------------------------------------------
    // 3. Find user's wallet
    // --------------------------------------------------
    {
      $lookup: {
        from: 'wallets',
        let: {
          userId: {
            $toString: '$_id',
          },
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: [
                  '$userId',
                  '$$userId',
                ],
              },
            },
          },
          {
            $project: {
              _id: 1,
            },
          },
        ],
        as: 'wallets',
      },
    },

    // --------------------------------------------------
    // 4. Find reward transactions
    // --------------------------------------------------
    {
      $lookup: {
        from: 'transactions',
        let: {
          walletIds: {
            $map: {
              input: '$wallets',
              as: 'wallet',
              in: {
                $toString: '$$wallet._id',
              },
            },
          },
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $in: [
                      '$walletId',
                      '$$walletIds',
                    ],
                  },
                  {
                    $eq: [
                      '$type',
                      TransactionType.CREDIT,
                    ],
                  },
                  {
                    $eq: [
                      '$source',
                      TransactionSource.REWARD,
                    ],
                  },
                  {
                    $eq: [
                      '$status',
                      TransactionStatus.COMPLETED,
                    ],
                  },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              total: {
                $sum: '$amount',
              },
            },
          },
        ],
        as: 'earnedStats',
      },
    },

    // --------------------------------------------------
    // 5. Calculate total earned
    // --------------------------------------------------
    {
      $addFields: {
        totalEarned: {
          $ifNull: [
            {
              $arrayElemAt: [
                '$earnedStats.total',
                0,
              ],
            },
            0,
          ],
        },
      },
    },

    // --------------------------------------------------
    // 6. Sort exactly like leaderboard
    // --------------------------------------------------
    {
      $sort: {
        totalEarned: -1,
        totalQuestions: -1,
        _id: 1,
      },
    },

    // --------------------------------------------------
    // 7. Find current user's position
    // --------------------------------------------------
    {
      $group: {
        _id: null,

        rankedUsers: {
          $push: {
            userId: {
              $toString: '$_id',
            },
          },
        },
      },
    },

    {
      $project: {
        _id: 0,

        userRank: {
          $let: {
            vars: {
              userIndex: {
                $indexOfArray: [
                  '$rankedUsers.userId',
                  userId,
                ],
              },
            },
            in: {
              $cond: [
                {
                  $eq: ['$$userIndex', -1],
                },
                null,
                {
                  $add: [
                    '$$userIndex',
                    1,
                  ],
                },
              ],
            },
          },
        },
      },
    },
  ]).exec();

  return result[0]?.userRank ?? null;
}

}
