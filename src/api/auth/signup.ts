import { AppError, HttpStatus } from '@helpers/errorHandler'
import UserModel from '@models/user.model'
import { Request, Response, RequestHandler, NextFunction } from 'express'

export type SignupRequest = {
  username: string
  password: string
  email: string
}

const signup: RequestHandler = async (
  req: Request<{}, {}, SignupRequest>,
  res: Response,
  next: NextFunction
) => {
  const { username, email, password } = req.body

  try {
    if (!username || !email || !password) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        'Incomplete registration data: Username, email, and password are required'
      )
    }

    const existingUser = await UserModel.findOne({
      $or: [{ username }, { email }]
    })
    if (existingUser) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'Username or email already exists')
    }
    const newUser = await UserModel.create({ username, email, password })

    res.status(HttpStatus.CREATED).json({ newUser })
  } catch (e: any) {
    next(e)
  }
}
export default signup
