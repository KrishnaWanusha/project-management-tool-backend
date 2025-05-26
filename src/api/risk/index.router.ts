// routes/estimatorRoutes.ts
import express from 'express'
import * as estimatorController from '../risk/estimatorController'

const estimateRouter = express.Router()

// Base story point estimation endpoints
estimateRouter.post('/', (req, res) => {
  estimatorController.estimateStoryPoints(req, res)
})

estimateRouter.post('/batch', (req, res) => {
  estimatorController.batchEstimateStoryPoints(req, res)
})

// Validation and optimization endpoints
estimateRouter.post('/validate', (req, res) => {
  estimatorController.validateModel(req, res)
})

estimateRouter.post('/optimal-influence', (req, res) => {
  estimatorController.findOptimalInfluence(req, res)
})

// Story management endpoints
estimateRouter.get('/stories', (req, res) => {
  estimatorController.getSavedStories(req, res)
})

estimateRouter.get('/projects/:projectId/stories', (req, res) => {
  estimatorController.getStoriesByProjectId(req, res)
})

estimateRouter.put('/update-team-estimate', (req, res) => {
  estimatorController.updateTeamEstimate(req, res)
})

estimateRouter.post('/save-story', (req, res) => {
  estimatorController.saveStory(req, res)
})

export default estimateRouter
