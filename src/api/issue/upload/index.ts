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
        // Initialize an array to store tasks
        const tasks = []
        const requirements = parsedRequirements.filter(
          (requirement: string | null) => requirement !== '' && requirement !== null
        )
        console.log('requirements', requirements)
        // Loop through each requirement and send it to the model one by one
        for (let i = 0; i < requirements.length; i++) {
          let requirement = requirements[i]
          if (requirement !== null) {
            const response = await axios.get(
              `http://localhost:8000/api/v1/predict?text=${requirement}`
            )
            tasks.push({ requirement, tasks: response.data?.tasks?.map((task: any) => task.task) })
          }
        }

        // Send the final response with all requirements and their tasks
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
