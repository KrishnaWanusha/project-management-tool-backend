import express from 'express'
import createIssue from './createIssue'

const projectRouter = express.Router()

projectRouter.post('/issues/create', createIssue)

export default projectRouter
