import { HttpStatus } from '@helpers/errorHandler'
import { Request, Response, RequestHandler, NextFunction } from 'express'
import createGitHubIssue from './github'

type Issue = {
  title: string
  body: string
  labels: string[]
}

type GithubIssue = {
  owner: string
  repo: string
  issues: Issue[]
}

const createIssue: RequestHandler = async (
  req: Request<{}, {}, GithubIssue>,
  res: Response,
  next: NextFunction
) => {
  const { owner, repo, issues } = req.body

  try {
    issues.forEach(async (issue) => {
      await createGitHubIssue({
        owner,
        repo,
        title: issue.title,
        body: issue.body,
        labels: issue.labels
      })
    })

    res.status(HttpStatus.CREATED).json({ success: true })
  } catch (e: any) {
    next(e)
  }
}
export default createIssue
