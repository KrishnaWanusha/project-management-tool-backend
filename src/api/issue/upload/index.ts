import { AppError, HttpStatus } from '@helpers/errorHandler'
import { Request, Response, RequestHandler, NextFunction } from 'express'
import fs from 'fs'
import { exec } from 'child_process'
import axios from 'axios'

type FileUploadReq = {
  file: File
}

const uploadFile: RequestHandler = (
  req: Request<{}, {}, FileUploadReq>,
  res: Response,
  next: NextFunction
) => {
  if (!req.file) {
    return next(new AppError(HttpStatus.BAD_REQUEST, 'File not found'))
  }

  const pdfPath = req.file.path
  const pythonScript = 'ai_model/extract_requirements.py'

  return new Promise<void>((resolve, _reject) => {
    exec(`python ${pythonScript} ${pdfPath}`, async (error, stdout, stderr) => {
      if (error) {
        console.error(`Python error: ${stderr}`)
        res.status(500).json({ error: 'Failed to extract requirements' })
        return resolve()
      }

      try {
        const parsedRequirements = JSON.parse(stdout)

        const { functional_requirements, non_functional_requirements } = parsedRequirements

        const splitToRequirements = (text: string | string[]) => {
          const cleaned = (Array.isArray(text) ? text.join(' ') : text)
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()

          const split = cleaned
            .split(/[.?!]\s+|\n+/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0)

          return split
        }

        const requirements = [
          ...splitToRequirements(functional_requirements),
          ...splitToRequirements(non_functional_requirements)
        ]
        const tasks = []
        for (let i = 0; i < requirements.length; i++) {
          const requirement = requirements[i]
          const response = await axios.get(
            `https://python.ugg-roleplay.com/taskapp/api/v1/predict?text=${encodeURIComponent(
              requirement ?? ''
            )}`
          )
          tasks.push({ requirement, tasks: response.data?.tasks?.map((task: any) => task.task) })
        }

        res.json({ tasks })
        resolve()
      } catch (err) {
        res.status(500).json({ error: 'Model prediction failed', err: err })
        resolve()
      } finally {
        // Clean up uploaded file
        fs.unlinkSync(pdfPath)
      }
    })
  })
}

export default uploadFile
