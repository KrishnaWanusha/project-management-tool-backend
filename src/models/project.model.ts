import { AutoIncrementID } from '@typegoose/auto-increment'
import { Severity, getModelForClass, modelOptions, plugin, prop } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import { IsEnum, IsString, IsOptional } from 'class-validator'
import mongoose, { Model } from 'mongoose'

export enum ProjectStatus {
  ACTIVE = 'Active',
  ON_HOLD = 'On Hold',
  COMPLETED = 'Completed'
}

export enum ProjectType {
  FRONTEND = 'Frontend',
  BACKEND = 'Backend',
  MOBILE = 'Mobile',
  FULLSTACK = 'FullStack',
  DEVOPS = 'DevOps',
  OTHER = 'Other'
}

@plugin(AutoIncrementID, { field: 'displayId', startAt: 1 })
@modelOptions({
  options: { allowMixed: Severity.ERROR, customName: 'projects' },
  schemaOptions: { collection: 'projects' }
})
export class Project extends TimeStamps {
  @prop({ unique: true })
  public displayId?: number

  @IsString()
  @prop({ required: true })
  public name!: string

  @IsString()
  @prop({ required: true })
  public description!: string

  @IsEnum(ProjectType)
  @prop({ type: String, enum: ProjectType, required: true })
  public type!: ProjectType

  @prop({ type: [String] })
  @IsOptional()
  public members?: string[]

  @IsEnum(ProjectStatus)
  @prop({ type: String, enum: ProjectStatus, default: ProjectStatus.ACTIVE })
  public status?: ProjectStatus

  @IsString()
  @prop()
  @IsOptional()
  public githubRepo?: string

  @IsString()
  @prop({ required: true })
  public owner!: string

  @IsString()
  @prop({ required: true })
  public repo!: string

  @IsString()
  @prop()
  @IsOptional()
  public authToken?: string
}

const ProjectModel = (mongoose.models?.projects as Model<Project>) ?? getModelForClass(Project)

export default ProjectModel
