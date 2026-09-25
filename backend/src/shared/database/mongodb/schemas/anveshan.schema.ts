import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CandidateDocument = Candidate & Document;

@Schema({ collection: 'candidates' })
export class Candidate {
  _id: Types.ObjectId;

  @Prop({ type: String, default: null })
  email: string | null;

  @Prop({ required: true, index: true })
  user_id: string;

  @Prop({ type: String, default: null })
  current_phase: string | null;

  @Prop({ type: Date })
  created_at: Date;

  @Prop({ type: Date })
  updated_at: Date;

  @Prop({ type: String, default: null })
  address: string | null;

  @Prop({ type: String, default: null })
  crops_grown: string | null;

  @Prop({ type: String, default: null })
  current_role: string | null;

  @Prop({ type: String, default: null })
  district: string | null;

  @Prop({ type: String, default: null })
  farming_background: string | null;

  @Prop({ type: String, default: null })
  full_name: string | null;

  @Prop({ type: String, default: null })
  highest_education: string | null;

  @Prop({ type: String, default: null })
  institution: string | null;

  @Prop({ type: String, default: null, index: true })
  phone: string | null;

  @Prop({ type: String, default: null })
  pincode: string | null;

  @Prop({ type: String, default: null })
  primary_expertise: string | null;

  @Prop({ type: String, default: null })
  state: string | null;

  @Prop({ type: Number, default: null })
  years_of_experience: number | null;

  @Prop({ type: Boolean, default: false })
  passed_and_visited_summary: boolean;
}

export const CandidateSchema = SchemaFactory.createForClass(Candidate);