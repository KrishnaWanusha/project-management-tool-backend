import { Request, Response } from 'express'

export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  MOVED_PERMANENTLY = 301,
  FOUND = 302,
  NOT_MODIFIED = 304,
  TEMPORARY_REDIRECT = 307,
  PERMANENT_REDIRECT = 308,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  PAYMENT_REQUIRED = 402,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  GONE = 410,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  SERVICE_UNAVAILABLE = 503
}

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
    this.name = 'AppError'
  }
}

export const errorHandler = (error: Error, _req: Request, res: Response) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message })
  } else {
    res.status(500).json({ error: 'Internal Server Error' })
  }
}
