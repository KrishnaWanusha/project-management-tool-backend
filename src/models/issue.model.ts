// models/storypoint.model.ts
import { Severity, getModelForClass, modelOptions, prop, index } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { IsNumber, IsOptional } from 'class-validator'
import mongoose, { Model } from 'mongoose'

@modelOptions({
  options: { allowMixed: Severity.ERROR, customName: 'issues' },
  schemaOptions: { collection: 'issues', timestamps: true }
})
@index({ githubId: 1 })
@index({ repository: 1 })
export class Issue extends TimeStamps {
  @prop({ unique: true })
  public githubId?: number

  @prop({ required: true })
  public repository!: string

  @IsNumber()
  @prop()
  @IsOptional()
  public storyPoint?: number

  @IsNumber()
  @prop()
  @IsOptional()
  public teamEstimate?: number

  @IsNumber()
  @prop({ required: true })
  @IsOptional()
  public confidence?: number

  @IsNumber()
  @prop({ required: true })
  @IsOptional()
  public fullAdjustment?: number

  @IsNumber()
  @prop({ required: true })
  @IsOptional()
  public appliedAdjustment?: number

  @IsNumber()
  @prop({ required: true })
  @IsOptional()
  public dqnInfluence?: number

  @IsNumber()
  @prop()
  @IsOptional()
  public difference?: number
}

// Export the model
const IssueModel = (mongoose.models?.issues as Model<Issue>) ?? getModelForClass(Issue)

export default IssueModel
