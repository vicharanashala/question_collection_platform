import { MongoRepository } from "@/shared/database/abstractions/mongo.repository";
import { Candidate } from "@/shared/database/mongodb/schemas/anveshan.schema";
import { Injectable } from "@nestjs/common";
import { IAnveshanCandidateRepository } from "../../IAnveshCandidate.repository";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ANVESHAN_CONNECTION } from "@/shared/database/mongodb/mongo.module";

@Injectable()
export class MongoAnveshCandidateRepository extends MongoRepository<Candidate> implements IAnveshanCandidateRepository{
    constructor(@InjectModel('Candidate', ANVESHAN_CONNECTION) protected readonly _model: Model<Candidate>){
        super(_model)
    }

    async findByPhone(phone: string): Promise<Candidate | null> {
        const user =  await this._model
        .findOne({phone} as Record<string, unknown>)
        .exec()
        return user
    }
}