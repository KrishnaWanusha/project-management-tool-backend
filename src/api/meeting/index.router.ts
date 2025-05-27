import express from 'express'
import createMeeting from './createMeeting'
import getAllMeetings from './getAllMeetings'
import getMeeting from './getMeeting'
import multer from 'multer'

const upload = multer({ storage: multer.memoryStorage() })

const meetingRouter = express.Router()

meetingRouter.post('/create', upload.single('uploadedFile'), createMeeting)
meetingRouter.get('/all', getAllMeetings)
meetingRouter.get('/get/:id', getMeeting)

export default meetingRouter
