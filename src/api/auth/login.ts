import { AppError, HttpStatus } from '@helpers/errorHandler'
import UserModel, { User, generateAccessToken, generateRefreshToken } from '@models/user.model'
import bcrypt from 'bcrypt'
import { Request, NextFunction, RequestHandler, Response } from 'express'

export type LoginRequest = {
  username: string
  password: string
}

const validatePassword = async (password: string, encryptedPassword: string) =>
  bcrypt.compare(password, encryptedPassword)

const login: RequestHandler = async (
  req: Request<{}, {}, LoginRequest>,
  res: Response,
  next: NextFunction
) => {
  const { username, password } = req.body

  try {
    if (!username || !password) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'Username or password not found')
    }

    const user = await UserModel.findOne({ username })

    if (!user || !(await validatePassword(password, user?.password!))) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'Username or password incorrect')
    }

    const accessToken = generateAccessToken((user as User)?.username)
    const refreshToken = generateRefreshToken((user as User)?.username)

    res.status(HttpStatus.OK).json({ accessToken, refreshToken })
  } catch (e: any) {
    next(e)
  }
}

export default login
