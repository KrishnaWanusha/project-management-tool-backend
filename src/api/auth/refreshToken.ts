import { AppError, HttpStatus } from '@helpers/errorHandler'
import { User, generateAccessToken } from '@models/user.model'
import { Request, NextFunction, RequestHandler, Response } from 'express'
import jwt from 'jsonwebtoken'

const refreshToken: RequestHandler = async (
  req: Request<{}, {}, { token: string }>,
  res: Response,
  next: NextFunction
) => {
  const { token } = req.body

  try {
    if (!token) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'Refresh token not found')
    }

    const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET as string)

    const accessToken = generateAccessToken((payload as User)?.username)
    res.status(HttpStatus.OK).json({ accessToken })
  } catch (e: any) {
    next(e)
  }
}

export default refreshToken
