import { AppError, HttpStatus } from '@helpers/errorHandler'
import { Request, Response, RequestHandler, NextFunction } from 'express'
import fs from 'fs/promises'
import pdfParse from 'pdf-parse'
import openAi from '../ai'
type FileUploadReq = {
  file: File
}

const uploadFile: RequestHandler = async (
  req: Request<{}, {}, FileUploadReq>,
  res: Response,
  next: NextFunction
) => {
  if (!req.file) {
    throw new AppError(HttpStatus.BAD_REQUEST, 'File not found')
  }

  try {
    // Read and parse PDF
    const dataBuffer = await fs.readFile(req.file.path)
    const pdfData = await pdfParse(dataBuffer)
    const extractedText = pdfData.text
    console.log(extractedText)
    const prompt = 'what is open ai'
    // const prompt = `
    //       Extract details from the following SRS document:
    //       ---
    //       ${extractedText}
    //       ---
    //       Provide:
    //       1. Project Name
    //       2. Key Requirements
    //       3. Expected Outcome
    // `
    const response = await openAi(prompt)

    res.status(HttpStatus.CREATED).json({ success: true, response })
  } catch (e: any) {
    next(e)
  }
}
export default uploadFile
