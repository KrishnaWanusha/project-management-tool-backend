import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const openAi = async (content: string): Promise<string> => {
  const chat = await client.chat.completions.create({
    messages: [{ role: 'user', content }],
    model: 'gpt-3.5-turbo',
    max_tokens: 1024
  })

  return chat?.choices[0]?.message.content || ''
}

export const description = async (sentence: string) => {
  const response = await client.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'Generate a description for this sentence.' },
      { role: 'user', content: sentence }
    ]
  })
  console.log(response.choices[0]?.message.content)
}

export default openAi
