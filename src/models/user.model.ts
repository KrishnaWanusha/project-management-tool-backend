import { AppError, HttpStatus } from '@helpers/errorHandler'
import { CustomReq } from '@helpers/requestHandler'
import { AutoIncrementID } from '@typegoose/auto-increment'
import { Severity, getModelForClass, modelOptions, plugin, prop, pre } from '@typegoose/typegoose'
import { TimeStamps } from '@typegoose/typegoose/lib/defaultClasses'
import bcrypt from 'bcrypt'
import { IsEnum, IsString, MinLength } from 'class-validator'
import { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import mongoose, { Model } from 'mongoose'

export enum UserRoles {
  ADMIN = 'Admin',
  MANAGER = 'Manager',
  USER = 'User'
}

export function generateAccessToken(username: any) {
  return jwt.sign({ username }, process.env.ACCESS_TOKEN_SECRET as string, {
    expiresIn: '1h'
  })
}

export function generateRefreshToken(username: any) {
  return jwt.sign({ username }, process.env.REFRESH_TOKEN_SECRET as string, {
    expiresIn: '1y'
  })
}

@pre<User>('save', async function hashPassword(next) {
  if (!this.isModified('password')) {
    return next()
  }

  try {
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(this.password, salt)
    this.password = hashedPassword
    return await next()
  } catch (e: any) {
    return next(e)
  }
})
@plugin(AutoIncrementID, { field: 'displayId', startAt: 1 })
@modelOptions({
  options: { allowMixed: Severity.ERROR, customName: 'users' },
  schemaOptions: { collection: 'users' }
})
export class User extends TimeStamps {
  @prop({ unique: true })
  public displayId?: number

  @IsString()
  @MinLength(3)
  @prop({ unique: true })
  public username!: string

  @prop()
  public password!: string

  @prop({ unique: true })
  @IsString()
  public email?: string

  @IsEnum(UserRoles)
  @prop({ type: String, enum: UserRoles, default: UserRoles.USER })
  public role?: UserRoles
}

const UserModel = (mongoose.models?.users as Model<User>) ?? getModelForClass(User)

export const checkPermissions = (user: User, roles: UserRoles[]) => {
  return user?.role && roles.includes(user.role)
}

export const AuthenticateToken: (roles?: UserRoles[]) => RequestHandler =
  (roles) => (req: CustomReq, _res, next) => {
    try {
      const authHeader = req.headers.authorization
      const token = authHeader && authHeader.split(' ')[1]

      if (!token) {
        throw new AppError(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED')
      }

      jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET as string,
        async (err: any, payload: any) => {
          try {
            if (err) {
              throw new AppError(HttpStatus.FORBIDDEN, 'FORBIDDEN')
            }

            const user = await UserModel.findOne({ username: (payload as any).username })

            if (roles && roles.length > 0) {
              if (!checkPermissions(user as User, roles)) {
                throw new AppError(HttpStatus.UNAUTHORIZED, "Don't have permission to access")
              }
            }
            req.user = user?.username
            next()
          } catch (e: any) {
            next(e)
          }
        }
      )
    } catch (e) {
      next(e)
    }
  }

export default UserModel
