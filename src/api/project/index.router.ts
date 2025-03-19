import express from 'express'
import createProject from './createProject'
import getAllProjects from './search'
import getProject from './get'

const projectRouter = express.Router()

projectRouter.post('/create', createProject)
projectRouter.get('/search', getAllProjects)
projectRouter.get('/get/:id', getProject)

export default projectRouter
