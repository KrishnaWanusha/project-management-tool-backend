import { Request, Response, NextFunction, RequestHandler } from 'express'
import { HttpStatus } from '@helpers/errorHandler'
import ProjectModel from '@models/project.model'

const getAllProjects: RequestHandler = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await ProjectModel.find()

    res.status(HttpStatus.OK).json({ success: true, projects })
  } catch (e: any) {
    next(e)
  }
}

export default getAllProjects
