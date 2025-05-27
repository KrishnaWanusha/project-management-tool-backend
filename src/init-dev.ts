import 'module-alias/register'
import dotenv from 'dotenv'
dotenv.config()
import { errorHandler } from '@helpers/errorHandler'
import express, { NextFunction, Request, Response } from 'express'

import authRouter from './api/auth/index.router'
import projectRouter from './api/project/index.router'
import estimateRouter from './api/risk/index.router'
import { connectDB } from './config/db'
import issueRouter from './api/issue/index.router'

connectDB()

export const app = express()

app.use(express.json())

app.use((req, _res, next) => {
  console.log(req.path, req.method)
  next()
})

app.get('/', (_, res) =>
  res.json({
    message: 'Welcome to Project Management Tool'
  })
)

app.use('/auth', authRouter)
app.use('/issues', issueRouter)
app.use('/project', projectRouter)
app.use('/estimate', estimateRouter)

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.log(err)
  errorHandler(err, req, res)
})
if (process.env.NODE_ENV !== 'test') {
  app.listen(process.env.PORT, () => {
    console.log(`Server is listening at http://localhost:${process.env.PORT}`)
  })
}
