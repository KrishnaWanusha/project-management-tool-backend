import { AutoIncrementID } from '@typegoose/auto-increment';
import { Severity, getModelForClass, modelOptions, plugin, prop } from '@typegoose/typegoose';
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses';
import { IsEnum, IsString, IsOptional, IsDate, IsArray, IsObject } from 'class-validator';
import mongoose, { Model } from 'mongoose';

// Enum for meeting types
export enum MeetingType {
  GENERAL = 'General',
  TECHNICAL = 'Technical',
  BUSINESS = 'Business',
  HR = 'HR',
  TRAINING = 'Training',
  OTHER = 'Other',
}

// Model for a member who is part of a meeting
export class Member {
  @IsString()
  @prop({ required: true })
  id!: string; // Member ID

  @IsString()
  @prop({ required: true })
  name!: string; // Member name

  @IsString()
  @IsOptional()
  @prop()
  email?: string; // Member email

  @IsString()
  @IsOptional()
  @prop()
  role?: string; // Member role

  @IsString()
  @IsOptional()
  @prop()
  avatarUrl?: string; // Member avatar URL
}

// Model for sentiment analysis result
export class Sentiment {
  @IsString()
  @prop({ required: true })
  label!: string; // Sentiment label (positive, neutral, negative)

  @IsOptional()
  @IsString()
  @prop()
  score?: number; // Sentiment score (optional)
}

// Meeting model using Typegoose with auto-increment functionality
@plugin(AutoIncrementID, { field: 'displayId', startAt: 1 })
@modelOptions({
  options: { allowMixed: Severity.ERROR, customName: 'meetings' },
  schemaOptions: { collection: 'meetings' }
})
export class Meeting extends TimeStamps {
  @prop({ unique: true })
  public displayId?: number; // Auto-increment displayId

  @IsString()
  @prop({ required: true })
  public name!: string; // Meeting name

  @IsString()
  @prop({ required: true })
  public description!: string; // Meeting description

  @IsEnum(MeetingType)
  @prop({ type: String, enum: MeetingType, required: true })
  public type!: MeetingType; // Meeting type (General, Technical, etc.)

  @IsDate()
  @prop({ required: true })
  public date!: Date; // Meeting date

  @IsArray()
  @IsOptional()
  @prop({ type: () => [Member] })
  public members?: Member[]; // List of members participating in the meeting

  @IsString()
  @IsOptional()
  @prop()
  public transcript?: string; // AI-generated transcript

  @IsString()
  @IsOptional()
  @prop()
  public summary?: string; // AI-generated summary

  @IsObject()
  @IsOptional()
  @prop({ type: () => Sentiment })
  public sentimentAnalysis?: Sentiment; // AI sentiment analysis result (label and score)

  @IsDate()
  @IsOptional()
  @prop()
  public createdAt?: Date; // Date of creation

  @IsDate()
  @IsOptional()
  @prop()
  public updatedAt?: Date; // Date of last update
}

// MongoDB model definition for the Meeting schema using `getModelForClass`
const MeetingModel = (mongoose.models?.meetings as Model<Meeting>) ?? getModelForClass(Meeting)

export default MeetingModel
