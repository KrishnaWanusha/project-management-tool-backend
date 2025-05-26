// controllers/estimatorController.ts
import { Request, Response } from 'express'
import estimatorService from './estimatorService'
import StoryModel, { ComparisonStatus, RiskLevel } from '../../models/storypoint.model'

/**
 * @param story The Story document from database
 * @returns A client-friendly story object with correct field names and types
 */
export const transformStoryForClient = (story: any) => {
  return {
    id: story._id?.toString(), // Convert MongoDB ObjectId to string id
    title: story.title,
    description: story.description || '',
    storyPoint: story.storyPoint,
    rfPrediction: story.rfPrediction,
    teamEstimate: story.teamEstimate,
    confidence: story.confidence,
    fullAdjustment: story.fullAdjustment,
    appliedAdjustment: story.appliedAdjustment,
    dqnInfluence: story.dqnInfluence,
    comparisonStatus: story.comparisonStatus,
    riskLevel: story.riskLevel,
    difference: story.difference,
    createdAt: story.createdAt instanceof Date ? story.createdAt.toISOString() : story.createdAt,
    updatedAt: story.updatedAt instanceof Date ? story.updatedAt.toISOString() : story.updatedAt,
    projectId: story.projectId
  }
}

/**
 * Estimate story points for a single user story
 * @route POST /api/estimate
 */
export const estimateStoryPoints = async (req: Request, res: Response) => {
  try {
    console.log('Received single estimation request:', req.body)
    const { title, description, dqnInfluence, projectId } = req.body

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      })
    }

    // Use provided dqnInfluence or default to 0.3
    const influence = typeof dqnInfluence === 'number' ? dqnInfluence : 0.3

    console.log(`Processing story: "${title}" with influence: ${influence}`)

    try {
      const result = await estimatorService.estimateStoryPoints(
        {
          title,
          description: description || '',
          projectId
        },
        influence
      )

      console.log('Estimation result:', result)

      return res.status(200).json({
        success: true,
        data: {
          storyPoint: result.adjusted_prediction,
          rfPrediction: result.rf_prediction,
          confidence: result.confidence,
          fullAdjustment: result.full_adjustment,
          appliedAdjustment: result.applied_adjustment,
          dqnInfluence: influence,
          input: {
            title,
            description: description || '',
            projectId
          }
        }
      })
    } catch (serviceError: any) {
      console.error('Service error during estimation:', serviceError)
      throw new Error(`Estimation service error: ${serviceError.message}`)
    }
  } catch (error: any) {
    console.error('Controller error:', error)

    // Ensure we always return JSON, never HTML
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred during estimation'
    })
  }
}

/**
 * Batch estimate story points for multiple user stories
 * @route POST /api/estimate/batch
 */
export const batchEstimateStoryPoints = async (req: Request, res: Response) => {
  try {
    console.log('Received batch estimation request')
    const { stories, dqnInfluence, projectId } = req.body

    console.log(
      `Request body: ${JSON.stringify({
        storiesCount: stories?.length,
        firstStory: stories?.[0],
        dqnInfluence,
        projectId
      })}`
    )

    if (!stories || !Array.isArray(stories) || stories.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid stories array is required'
      })
    }

    // Validate each story has a title
    for (const [index, story] of stories.entries()) {
      if (!story.title) {
        console.error(`Story at index ${index} is missing a title`)
        return res.status(400).json({
          success: false,
          error: `Story at index ${index} is missing a title`
        })
      }
    }

    // Use provided dqnInfluence or default to 0.3
    const influence = typeof dqnInfluence === 'number' ? dqnInfluence : 0.3
    console.log(`Processing ${stories.length} stories with influence: ${influence}`)

    try {
      // Add projectId to each story if provided
      const storiesWithProject = projectId
        ? stories.map((story) => ({
            ...story,
            projectId
          }))
        : stories

      const results = await estimatorService.batchEstimateStoryPoints(storiesWithProject, influence)

      console.log(`Successfully processed ${results.length} stories`)

      // Combine original input with results
      // Safer version of the mapping function
      const combinedResults = stories.map((story, index) => {
        // Check if the result exists at this index
        if (!results[index]) {
          console.error(`Missing result for story at index ${index}`)
          return {
            ...story,
            storyPoint: 0,
            rfPrediction: 0,
            confidence: 0,
            fullAdjustment: 0,
            appliedAdjustment: 0,
            dqnInfluence: influence,
            projectId,
            error: 'No prediction available'
          }
        }

        const result = results[index]
        return {
          ...story,
          storyPoint: result.adjusted_prediction,
          rfPrediction: result.rf_prediction,
          confidence: result.confidence,
          fullAdjustment: result.full_adjustment,
          appliedAdjustment: result.applied_adjustment,
          dqnInfluence: influence,
          projectId
        }
      })

      return res.status(200).json({
        success: true,
        data: combinedResults
      })
    } catch (serviceError: any) {
      console.error('Service error during batch estimation:', serviceError)
      throw new Error(`Batch estimation service error: ${serviceError.message}`)
    }
  } catch (error: any) {
    console.error('Controller error:', error)

    // Ensure we always return JSON, never HTML
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred during batch estimation'
    })
  }
}

/**
 * Validate model performance using test data
 * @route POST /api/estimate/validate
 */
export const validateModel = async (req: Request, res: Response) => {
  try {
    console.log('Received validation request:', req.body)
    const { testDataPath, dqnInfluence } = req.body

    if (!testDataPath) {
      return res.status(400).json({
        success: false,
        error: 'Test data path is required'
      })
    }

    // Use provided dqnInfluence or default to 0.3
    const influence = typeof dqnInfluence === 'number' ? dqnInfluence : 0.3

    try {
      const metrics = await estimatorService.validateModel(testDataPath, influence)

      return res.status(200).json({
        success: true,
        data: metrics
      })
    } catch (serviceError: any) {
      console.error('Service error during validation:', serviceError)
      throw new Error(`Validation service error: ${serviceError.message}`)
    }
  } catch (error: any) {
    console.error('Controller error:', error)

    // Ensure we always return JSON, never HTML
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred during model validation'
    })
  }
}

/**
 * Find the optimal DQN influence value
 * @route POST /api/estimate/optimal-influence
 */
export const findOptimalInfluence = async (req: Request, res: Response) => {
  try {
    console.log('Received optimal influence request:', req.body)
    const { testDataPath, influenceValues } = req.body

    if (!testDataPath) {
      return res.status(400).json({
        success: false,
        error: 'Test data path is required'
      })
    }

    try {
      const optimal = await estimatorService.findOptimalInfluence(testDataPath, influenceValues)

      return res.status(200).json({
        success: true,
        data: optimal
      })
    } catch (serviceError: any) {
      console.error('Service error finding optimal influence:', serviceError)
      throw new Error(`Optimal influence service error: ${serviceError.message}`)
    }
  } catch (error: any) {
    console.error('Controller error:', error)

    // Ensure we always return JSON, never HTML
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred finding optimal influence'
    })
  }
}

/**
 * Get all saved story estimations
 * @route GET /api/estimate/stories
 */
export const getSavedStories = async (_req: Request, res: Response) => {
  try {
    console.log('Received request for saved stories')

    try {
      const stories = await estimatorService.getSavedStories()
      console.log(`Retrieved ${stories.length} saved stories`)

      // Process stories to ensure they have risk assessment data and transform for frontend
      const processedStories = stories.map((story) => {
        // Transform MongoDB document to the expected frontend format
        const transformedStory = transformStoryForClient(story)

        // If there's a team estimate but no risk assessment data, calculate it
        if (
          transformedStory.teamEstimate !== undefined &&
          transformedStory.teamEstimate !== null &&
          (!transformedStory.difference ||
            !transformedStory.comparisonStatus ||
            !transformedStory.riskLevel)
        ) {
          // Calculate difference
          const difference = transformedStory.teamEstimate - transformedStory.storyPoint
          const absDifference = Math.abs(difference)
          transformedStory.difference = difference

          // Determine comparison status and risk level
          if (absDifference > 5) {
            transformedStory.comparisonStatus =
              difference > 0
                ? ComparisonStatus.SEVERE_OVERESTIMATE
                : ComparisonStatus.SEVERE_UNDERESTIMATE
            transformedStory.riskLevel = RiskLevel.HIGH
          } else if (absDifference >= 3) {
            transformedStory.comparisonStatus =
              difference > 0
                ? ComparisonStatus.MILD_OVERESTIMATE
                : ComparisonStatus.MILD_UNDERESTIMATE
            transformedStory.riskLevel = RiskLevel.MEDIUM
          } else if (absDifference > 0) {
            transformedStory.comparisonStatus =
              difference > 0
                ? ComparisonStatus.SLIGHT_OVERESTIMATE
                : ComparisonStatus.SLIGHT_UNDERESTIMATE
            transformedStory.riskLevel = RiskLevel.LOW
          } else {
            transformedStory.comparisonStatus = ComparisonStatus.ACCURATE
            transformedStory.riskLevel = RiskLevel.LOW
          }
        }

        return transformedStory
      })

      // Log the first story for debugging
      if (processedStories.length > 0) {
        console.log('First processed story:', JSON.stringify(processedStories[0], null, 2))
      }

      return res.status(200).json({
        success: true,
        results: processedStories.length,
        data: processedStories
      })
    } catch (serviceError: any) {
      console.error('Service error retrieving stories:', serviceError)
      throw new Error(`Story retrieval service error: ${serviceError.message}`)
    }
  } catch (error: any) {
    console.error('Controller error:', error)

    // Ensure we always return JSON, never HTML
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred retrieving stories'
    })
  }
}

/**
 * Get stories by project ID
 * @route GET /api/estimate/projects/:projectId/stories
 */
export const getStoriesByProjectId = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    console.log(`Received request for stories in project: ${projectId}`)

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required'
      })
    }

    try {
      const stories = await estimatorService.getStoriesByProjectId(projectId)
      console.log(`Retrieved ${stories.length} stories for project ${projectId}`)

      // Transform stories to match frontend expectations
      const transformedStories = stories.map((story) => transformStoryForClient(story))

      return res.status(200).json({
        success: true,
        results: transformedStories.length,
        data: transformedStories
      })
    } catch (serviceError: any) {
      console.error('Service error retrieving project stories:', serviceError)
      throw new Error(`Project story retrieval error: ${serviceError.message}`)
    }
  } catch (error: any) {
    console.error('Controller error:', error)

    // Ensure we always return JSON, never HTML
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred retrieving project stories'
    })
  }
}

/**
 * Update team estimate for a story
 * @route PUT /api/estimate/update-team-estimate
 */
export const updateTeamEstimate = async (req: Request, res: Response) => {
  try {
    console.log('Received update team estimate request:', req.body)
    const { storyId, teamEstimate } = req.body

    if (!storyId) {
      return res.status(400).json({
        success: false,
        error: 'Story ID is required'
      })
    }

    if (teamEstimate === undefined || teamEstimate === null) {
      return res.status(400).json({
        success: false,
        error: 'Team estimate is required'
      })
    }

    try {
      const updatedStory = await estimatorService.updateTeamEstimate(
        storyId,
        parseFloat(teamEstimate) // Ensure it's a number
      )

      // Transform the result to match frontend expectations
      const transformedStory = transformStoryForClient(updatedStory)

      console.log('Successfully updated team estimate for story:', transformedStory)

      return res.status(200).json({
        success: true,
        data: transformedStory
      })
    } catch (serviceError: any) {
      console.error('Service error updating team estimate:', serviceError)
      throw new Error(`Team estimate update error: ${serviceError.message}`)
    }
  } catch (error: any) {
    console.error('Controller error:', error)

    // Ensure we always return JSON, never HTML
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred updating team estimate'
    })
  }
}

/**
 * Save a new story with complete data
 * @route POST /api/estimate/save-story
 */
export const saveStory = async (req: Request, res: Response) => {
  try {
    console.log('Received save story request:', req.body)
    const {
      title,
      description,
      storyPoint,
      rfPrediction,
      confidence,
      fullAdjustment,
      appliedAdjustment,
      dqnInfluence,
      teamEstimate,
      projectId
    } = req.body

    if (!title || storyPoint === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Title and storyPoint are required'
      })
    }

    try {
      // Prepare story data
      const storyData: any = {
        title,
        description: description || '',
        storyPoint: parseFloat(storyPoint),
        rfPrediction: parseFloat(rfPrediction),
        confidence: parseFloat(confidence),
        fullAdjustment: parseFloat(fullAdjustment),
        appliedAdjustment: parseFloat(appliedAdjustment),
        dqnInfluence: parseFloat(dqnInfluence || 0.3)
      }

      // Add project ID if provided
      if (projectId) {
        storyData.projectId = projectId
      }

      // Calculate risk assessment if team estimate provided
      if (teamEstimate !== undefined && teamEstimate !== null) {
        const teamEstimateValue = parseFloat(teamEstimate)
        storyData.teamEstimate = teamEstimateValue

        // Calculate difference
        const difference = teamEstimateValue - storyData.storyPoint
        const absDifference = Math.abs(difference)
        storyData.difference = difference

        // Determine comparison status and risk level
        if (absDifference > 5) {
          storyData.comparisonStatus =
            difference > 0
              ? ComparisonStatus.SEVERE_OVERESTIMATE
              : ComparisonStatus.SEVERE_UNDERESTIMATE
          storyData.riskLevel = RiskLevel.HIGH
        } else if (absDifference >= 3) {
          storyData.comparisonStatus =
            difference > 0
              ? ComparisonStatus.MILD_OVERESTIMATE
              : ComparisonStatus.MILD_UNDERESTIMATE
          storyData.riskLevel = RiskLevel.MEDIUM
        } else if (absDifference > 0) {
          storyData.comparisonStatus =
            difference > 0
              ? ComparisonStatus.SLIGHT_OVERESTIMATE
              : ComparisonStatus.SLIGHT_UNDERESTIMATE
          storyData.riskLevel = RiskLevel.LOW
        } else {
          storyData.comparisonStatus = ComparisonStatus.ACCURATE
          storyData.riskLevel = RiskLevel.LOW
        }
      }

      // Create the new story using Typegoose model
      const savedStory = await StoryModel.create(storyData)

      // Transform the result to match frontend expectations
      const transformedStory = transformStoryForClient(savedStory)

      console.log('Successfully saved new story:', transformedStory)

      return res.status(201).json({
        success: true,
        data: transformedStory
      })
    } catch (serviceError: any) {
      console.error('Service error saving story:', serviceError)
      throw new Error(`Story save error: ${serviceError.message}`)
    }
  } catch (error: any) {
    console.error('Controller error:', error)

    // Ensure we always return JSON, never HTML
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred saving the story'
    })
  }
}
