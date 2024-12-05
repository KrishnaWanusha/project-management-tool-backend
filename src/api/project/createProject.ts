import { HttpStatus } from '@helpers/errorHandler'
import { Request, Response, RequestHandler, NextFunction } from 'express'
import ProjectModel, { Project } from '@models/project.model'

const createProject: RequestHandler = async (
  req: Request<{}, {}, Project>,
  res: Response,
  next: NextFunction
) => {
  try {
    const newProject = await ProjectModel.create({ status: 'Active', ...req.body })

    res.status(HttpStatus.CREATED).json({ success: true, data: newProject })
  } catch (e: any) {
    next(e)
  }
}
export default createProject
