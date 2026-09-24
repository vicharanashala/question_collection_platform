import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AgriEntityStatus, AgriEntityType } from '../../../classes/enums';

export type AgriEntityDocument = AgriEntity & Document;

@Schema({ _id: false })
export class AgriEntityAlternateName {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  source: string;
}

const AgriEntityAlternateNameSchema = SchemaFactory.createForClass(AgriEntityAlternateName);

@Schema({ collection: 'agri_entities', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class AgriEntity {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, enum: AgriEntityType, index: true })
  type: AgriEntityType;

  @Prop({ required: true })
  localName: string;

  @Prop({ required: true })
  englishName: string;

  @Prop({ required: true })
  botanicalName: string;

  @Prop({ required: true })
  localNameSource: string;

  @Prop({ type: [AgriEntityAlternateNameSchema], required: true })
  alternateNames: AgriEntityAlternateName[];

  @Prop({ type: [String], required: true })
  imageUrls: string[];

  @Prop({ required: true, enum: AgriEntityStatus, default: AgriEntityStatus.PENDING, index: true })
  status: AgriEntityStatus;

  @Prop({ name: 'createdAt' })
  createdAt: Date;

  @Prop({ name: 'updatedAt' })
  updatedAt: Date;
}

export const AgriEntitySchema = SchemaFactory.createForClass(AgriEntity);
