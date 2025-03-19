// services/estimatorService.ts
import { PythonShell, Options } from 'python-shell'
import path from 'path'
import StoryModel, { ComparisonStatus, RiskLevel } from '../../models/storypoint.model'

export interface StoryInput {
  title: string
  description?: string
  projectId?: string
  teamEstimate?: number
}

export interface EstimationResult {
  rf_prediction: number
  adjusted_prediction: number
  confidence: number
  full_adjustment: number
  applied_adjustment: number
}

export interface ValidationMetrics {
  rf_accuracy: number
  hybrid_accuracy: number
  accuracy_improvement: number
  accuracy_improvement_percentage: number
  rf_mae: number
  hybrid_mae: number
  mae_improvement: number
  mae_improvement_percentage: number
  rf_within_1: number
  hybrid_within_1: number
  rf_within_2: number
  hybrid_within_2: number
  stories_improved: number
  stories_worsened: number
  stories_unchanged: number
  improvement_rate: number
  worsening_rate: number
  total_stories: number
  avg_confidence: number
  avg_full_adjustment: number
  avg_applied_adjustment: number
  dqn_influence: number
}

export interface OptimalInfluenceResult {
  best_influence: number
  best_accuracy: number
  results: {
    influence: number
    hybrid_accuracy: number
    rf_accuracy: number
    improvement: number
    improvement_percentage: number
    improved_stories: number
    worsened_stories: number
    unchanged_stories: number
  }[]
}

export class EstimatorService {
  private pythonScriptPath: string

  constructor() {
    // Path to Python script
    this.pythonScriptPath = path.join(__dirname, '../../../models/risk/predict.py')
  }

  /**
   * Estimate story points for a user story
   * @param input User story input with title and description
   * @param dqnInfluence Weight of DQN adjustment (0.0-1.0), default 0.3
   * @param saveToDb Whether to save results to database
   * @returns Estimation result with predictions and confidence
   */
  async estimateStoryPoints(
    input: StoryInput,
    dqnInfluence = 0.3,
    saveToDb = true
  ): Promise<EstimationResult> {
    try {
      // Prepare options for Python Shell
      const options: Options = {
        mode: 'json' as const,
        pythonPath: 'python', // Ensure Python 3 is installed and in PATH
        args: [JSON.stringify(input), String(dqnInfluence)]
      }

      // Run Python script
      const results = await PythonShell.run(this.pythonScriptPath, options)

      // Check if we have valid results
      if (!results || results.length === 0) {
        throw new Error('No estimation result returned')
      }

      const result = results[0]

      // Check for errors
      if (result.error) {
        throw new Error(`Estimation failed: ${result.error}`)
      }

      // Save to database if requested
      if (saveToDb) {
        await StoryModel.create({
          title: input.title,
          description: input.description || '',
          rfPrediction: result.rf_prediction,
          storyPoint: result.adjusted_prediction,
          confidence: result.confidence,
          fullAdjustment: result.full_adjustment,
          appliedAdjustment: result.applied_adjustment,
          dqnInfluence: dqnInfluence,
          projectId: input.projectId // Added project ID
        })
      }

      return result
    } catch (error: any) {
      console.error('Estimation error:', error)
      throw new Error(`Failed to estimate story points: ${error.message}`)
    }
  }

  /**
   * Estimate story points for multiple user stories in batch
   * @param inputs Array of user story inputs
   * @param dqnInfluence Weight of DQN adjustment (0.0-1.0), default 0.3
   * @param saveToDb Whether to save results to database
   * @returns Array of estimation results
   */
  async batchEstimateStoryPoints(
    inputs: StoryInput[],
    dqnInfluence = 0.3,
    saveToDb = true
  ): Promise<EstimationResult[]> {
    try {
      // Prepare options for Python Shell
      const options: Options = {
        mode: 'json' as const,
        pythonPath: 'python',
        args: [JSON.stringify(inputs), String(dqnInfluence)]
      }

      // Run Python script
      const results = await PythonShell.run(this.pythonScriptPath, options)

      if (!results || results.length === 0) {
        throw new Error('No estimation results returned')
      }

      const estimations = results[0]

      // Save to database if requested
      if (saveToDb) {
        const storiesToSave = inputs.map((input, index) => {
          // Start with the base story data
          const storyData: any = {
            title: input.title,
            description: input.description || '',
            rfPrediction: estimations[index].rf_prediction,
            storyPoint: estimations[index].adjusted_prediction,
            confidence: estimations[index].confidence,
            fullAdjustment: estimations[index].full_adjustment,
            appliedAdjustment: estimations[index].applied_adjustment,
            dqnInfluence: dqnInfluence,
            projectId: input.projectId
          }

          // If there's a team estimate, add it and calculate risk assessment data
          if (
            'teamEstimate' in input &&
            input.teamEstimate !== undefined &&
            input.teamEstimate !== null
          ) {
            const teamEstimateValue =
              typeof input.teamEstimate === 'number'
                ? input.teamEstimate
                : parseFloat(String(input.teamEstimate))

            if (!isNaN(teamEstimateValue)) {
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
          }

          return storyData
        })

        // Use insertMany for batch insertion
        await StoryModel.insertMany(storiesToSave)
      }

      return estimations
    } catch (error: any) {
      console.error('Batch estimation error:', error)
      throw new Error(`Failed to batch estimate story points: ${error.message}`)
    }
  }

  /**
   * Validate model performance using test data
   * @param testDataPath Path to CSV file with test data
   * @param dqnInfluence Weight of DQN adjustment (0.0-1.0), default 0.3
   * @returns Validation metrics
   */
  async validateModel(testDataPath: string, dqnInfluence = 0.3): Promise<ValidationMetrics> {
    try {
      // Prepare options for Python Shell
      const options: Options = {
        mode: 'json' as const,
        pythonPath: 'python',
        args: ['--validate', testDataPath, String(dqnInfluence)]
      }

      // Run Python script
      const results = await PythonShell.run(this.pythonScriptPath, options)

      if (!results || results.length === 0) {
        throw new Error('No validation results returned')
      }

      return results[0] as ValidationMetrics
    } catch (error: any) {
      console.error('Validation error:', error)
      throw new Error(`Failed to validate model: ${error.message}`)
    }
  }

  /**
   * Find the optimal DQN influence value
   * @param testDataPath Path to CSV file with test data
   * @param influenceValues Optional array of influence values to test
   * @returns Optimal influence results
   */
  async findOptimalInfluence(
    testDataPath: string,
    influenceValues?: number[]
  ): Promise<OptimalInfluenceResult> {
    try {
      // Prepare options for Python Shell
      const options: Options = {
        mode: 'json' as const,
        pythonPath: 'python',
        args: ['--find-optimal', testDataPath]
      }

      // Add influence values if provided
      if (influenceValues && influenceValues.length > 0) {
        // Make sure options.args exists before pushing to it
        if (options.args) {
          options.args.push(influenceValues.join(','))
        }
      }

      // Run Python script
      const results = await PythonShell.run(this.pythonScriptPath, options)

      if (!results || results.length === 0) {
        throw new Error('No optimal influence results returned')
      }

      return results[0] as OptimalInfluenceResult
    } catch (error: any) {
      console.error('Optimal influence error:', error)
      throw new Error(`Failed to find optimal influence: ${error.message}`)
    }
  }

  async getSavedStories() {
    const stories = await StoryModel.find().sort({ createdAt: -1 })
    console.log(`Retrieved ${stories.length} stories from database`)

    // Process stories to ensure they have risk assessment data
    const processedStories = await Promise.all(
      stories.map(async (story) => {
        // Check if we need to update the story in the database
        let needsUpdate = false

        if (story.teamEstimate !== undefined && story.teamEstimate !== null) {
          if (!story.difference || !story.comparisonStatus || !story.riskLevel) {
            console.log(`Processing story ${story._id}: Has team estimate but missing risk data`)

            // Calculate difference
            const difference = story.teamEstimate - story.storyPoint
            const absDifference = Math.abs(difference)
            story.difference = difference

            // Determine comparison status and risk level
            if (absDifference > 5) {
              story.comparisonStatus =
                difference > 0
                  ? ComparisonStatus.SEVERE_OVERESTIMATE
                  : ComparisonStatus.SEVERE_UNDERESTIMATE
              story.riskLevel = RiskLevel.HIGH
            } else if (absDifference >= 3) {
              story.comparisonStatus =
                difference > 0
                  ? ComparisonStatus.MILD_OVERESTIMATE
                  : ComparisonStatus.MILD_UNDERESTIMATE
              story.riskLevel = RiskLevel.MEDIUM
            } else if (absDifference > 0) {
              story.comparisonStatus =
                difference > 0
                  ? ComparisonStatus.SLIGHT_OVERESTIMATE
                  : ComparisonStatus.SLIGHT_UNDERESTIMATE
              story.riskLevel = RiskLevel.LOW
            } else {
              story.comparisonStatus = ComparisonStatus.ACCURATE
              story.riskLevel = RiskLevel.LOW
            }

            needsUpdate = true
          }
        }

        // Update the database if needed
        if (needsUpdate) {
          console.log(`Updating story ${story._id} in database with risk assessment data`)

          try {
            const updateData = {
              difference: story.difference,
              comparisonStatus: story.comparisonStatus,
              riskLevel: story.riskLevel
            }

            // Only include fields that actually have values
            const filteredUpdateData = Object.fromEntries(
              Object.entries(updateData).filter(([_, v]) => v !== undefined)
            )

            // Update the story in the database
            await StoryModel.findByIdAndUpdate(
              story._id,
              { $set: filteredUpdateData },
              { new: false }
            )
          } catch (err) {
            console.error(`Error updating story ${story._id} with risk assessment:`, err)
          }
        }

        return story
      })
    )

    console.log(`Processed ${processedStories.length} stories with risk assessment data`)
    return processedStories
  }

  /**
   * Get stories by project ID
   * @param projectId The project ID to filter by
   * @returns Array of stories for the specified project
   */
  async getStoriesByProjectId(projectId: string) {
    return StoryModel.find({ projectId }).sort({ createdAt: -1 })
  }

  /**
   * Update team estimate for a story and calculate difference, comparison status, and risk level
   * @param storyId ID of the story to update
   * @param teamEstimate Team's estimate value
   * @returns Updated story document
   */
  async updateTeamEstimate(storyId: string, teamEstimate: number) {
    try {
      console.log(`Updating story ${storyId} with team estimate ${teamEstimate}`)

      // Find the story by ID
      const story = await StoryModel.findById(storyId)

      if (!story) {
        throw new Error(`Story with ID ${storyId} not found`)
      }

      // Calculate difference
      const difference = teamEstimate - story.storyPoint
      const absDifference = Math.abs(difference)

      // Determine comparison status and risk level
      let comparisonStatus, riskLevel

      if (absDifference > 5) {
        // High risk: difference greater than 5
        comparisonStatus =
          difference > 0
            ? ComparisonStatus.SEVERE_OVERESTIMATE
            : ComparisonStatus.SEVERE_UNDERESTIMATE
        riskLevel = RiskLevel.HIGH
      } else if (absDifference >= 3) {
        // Medium risk: difference greater than or equal to 3
        comparisonStatus =
          difference > 0 ? ComparisonStatus.MILD_OVERESTIMATE : ComparisonStatus.MILD_UNDERESTIMATE
        riskLevel = RiskLevel.MEDIUM
      } else if (absDifference > 0) {
        // Low risk: any non-zero difference up to 3 (exclusive)
        comparisonStatus =
          difference > 0
            ? ComparisonStatus.SLIGHT_OVERESTIMATE
            : ComparisonStatus.SLIGHT_UNDERESTIMATE
        riskLevel = RiskLevel.LOW
      } else {
        // Accurate: exactly equal (difference is 0)
        comparisonStatus = ComparisonStatus.ACCURATE
        riskLevel = RiskLevel.LOW
      }

      console.log(
        `Calculated: difference=${difference}, status=${comparisonStatus}, risk=${riskLevel}`
      )

      // Update the story with all fields
      const updatedStory = await StoryModel.findByIdAndUpdate(
        storyId,
        {
          $set: {
            teamEstimate: teamEstimate,
            difference: difference,
            comparisonStatus: comparisonStatus,
            riskLevel: riskLevel
          }
        },
        { new: true } // Return the updated document
      )

      if (!updatedStory) {
        throw new Error(`Failed to update story with ID ${storyId}`)
      }

      console.log('Database update complete:', updatedStory)
      return updatedStory
    } catch (error: any) {
      console.error('Error updating team estimate:', error)
      throw new Error(`Failed to update team estimate: ${error.message}`)
    }
  }

  getPythonScriptPath(): string {
    return this.pythonScriptPath
  }
}

// Export singleton instance as the default export
const estimatorService = new EstimatorService()
export default estimatorService
