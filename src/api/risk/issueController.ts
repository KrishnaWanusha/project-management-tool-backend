// controllers/estimatorController.ts
import { Request, Response } from 'express'
import IssueModel from '../../models/issue.model'

export const getIssuesByRepository = async (req: Request, res: Response) => {
  try {
    const { repo } = req.query

    if (!repo) {
      return res.status(400).json({
        success: false,
        error: 'Repository is required'
      })
    }

    try {
      const issues = await IssueModel.find({ repository: repo })

      return res.status(200).json({
        success: true,
        data: issues
      })
    } catch (serviceError: any) {
      throw new Error(`Issues retrieval error: ${serviceError.message}`)
    }
  } catch (error: any) {
    console.error('Controller error:', error)

    // Ensure we always return JSON, never HTML
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred retrieving issues'
    })
  }
}
