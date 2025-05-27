import { Octokit } from '@octokit/rest'

interface GithubIssue {
  owner: string
  repo: string
  title: string
  body: string
  labels: string[]
}

// Initialize Octokit with your personal access token
const octokit = new Octokit({
  auth: process.env.G_AUTH
})

export const createGitHubIssue = async (context: GithubIssue) => {
  try {
    const response = await octokit.rest.issues.create({
      ...context
    })
    console.log('Issue created:', response.data.html_url)
  } catch (error) {
    console.error('Error creating issue:', error)
  }
}

export const getAllGitHubIssues = async (owner: string, repo: string) => {
  try {
    const response = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: 'all',
      per_page: 100
    })

    const issues = response.data || []
    return issues
  } catch (error) {
    console.error('Error fetching issues:', error)
    return []
  }
}
