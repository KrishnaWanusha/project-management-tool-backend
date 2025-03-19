import { Request, Response, NextFunction, RequestHandler } from 'express'
import { AppError, HttpStatus } from '@helpers/errorHandler'
import ProjectModel from '@models/project.model'
import { getAllGitHubIssues } from '../issue/github'

const getProject: RequestHandler = async (req: Request<any>, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const project = await ProjectModel.findOne({ displayId: id }).lean()
    if (!project) throw new AppError(HttpStatus.NOT_FOUND, 'Project not found')
    const response = await getAllGitHubIssues(project.owner, project?.repo)
    const issues = response.map((issue) => {
      const { user, reactions, closed_by, ...rest } = issue
      return rest
    })
    res.status(HttpStatus.OK).json({ success: true, project: { ...project, issues } })
  } catch (e: any) {
    next(e)
  }
}

export default getProject
