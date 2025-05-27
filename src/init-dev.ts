import { errorHandler } from '@helpers/errorHandler'
import cors from 'cors'
import dotenv from 'dotenv'
import express, { NextFunction, Request, Response } from 'express'

import authRouter from './api/auth/index.router'
import { connectDB } from './config/db'

dotenv.config()
import issueRouter from './api/issue/index.router'
import meetingRouter from "./api/meeting/index.router";
//import { initializeFirebase } from "./config/firebaseConfig";

connectDB()
//initializeFirebase()

export const app = express()

app.use(cors())
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
app.use("/meeting", meetingRouter);

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.log(err)
  errorHandler(err, req, res)
})
if (process.env.NODE_ENV !== 'test') {
  app.listen(process.env.PORT, () => {
    console.log(`Server is listening at http://localhost:${process.env.PORT}`)
  })
}
