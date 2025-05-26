// models/storypoint.model.ts
import { AutoIncrementID } from '@typegoose/auto-increment'
import { Severity, getModelForClass, modelOptions, plugin, prop, index } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator'
import mongoose, { Model } from 'mongoose'

export enum ComparisonStatus {
  SEVERE_OVERESTIMATE = 'severe-overestimate',
  MILD_OVERESTIMATE = 'mild-overestimate',
  SLIGHT_OVERESTIMATE = 'slight-overestimate',
  ACCURATE = 'accurate',
  SLIGHT_UNDERESTIMATE = 'slight-underestimate',
  MILD_UNDERESTIMATE = 'mild-underestimate',
  SEVERE_UNDERESTIMATE = 'severe-underestimate'
}

export enum RiskLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

@plugin(AutoIncrementID, { field: 'displayId', startAt: 1 })
@modelOptions({
  options: { allowMixed: Severity.ERROR, customName: 'stories' },
  schemaOptions: { collection: 'stories', timestamps: true }
})
@index({ createdAt: -1 })
@index({ title: 1 })
@index({ storyPoint: 1 })
@index({ riskLevel: 1 })
@index({ projectId: 1 })
export class Story extends TimeStamps {
  @prop({ unique: true })
  public displayId?: number

  @IsString()
  @prop({ required: true })
  public title!: string

  @IsString()
  @prop({ default: '' })
  public description!: string

  @IsNumber()
  @prop({ required: true })
  public rfPrediction!: number

  @IsNumber()
  @prop({ required: true })
  public storyPoint!: number

  @IsNumber()
  @prop()
  @IsOptional()
  public teamEstimate?: number

  @IsNumber()
  @prop({ required: true })
  public confidence!: number

  @IsNumber()
  @prop({ required: true })
  public fullAdjustment!: number

  @IsNumber()
  @prop({ required: true })
  public appliedAdjustment!: number

  @IsNumber()
  @prop({ required: true })
  public dqnInfluence!: number

  @IsNumber()
  @prop()
  @IsOptional()
  public difference?: number

  @IsEnum(ComparisonStatus)
  @prop({ type: String, enum: ComparisonStatus })
  @IsOptional()
  public comparisonStatus?: ComparisonStatus

  @IsEnum(RiskLevel)
  @prop({ type: String, enum: RiskLevel })
  @IsOptional()
  public riskLevel?: RiskLevel

  @IsString()
  @prop()
  @IsOptional()
  public projectId?: string
}

// Export the model
const StoryModel = (mongoose.models?.stories as Model<Story>) ?? getModelForClass(Story)

export default StoryModel
