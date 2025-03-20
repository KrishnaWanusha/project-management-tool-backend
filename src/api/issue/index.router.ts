import express from 'express'
import multer from 'multer'
import createIssue from './create'
import uploadFile from './upload'
const upload = multer({ dest: 'uploads/' })

const issueRouter = express.Router()

issueRouter.post('/srs/upload', upload.single('file'), uploadFile)

issueRouter.post('/create', createIssue)

export default issueRouter
