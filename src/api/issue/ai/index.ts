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

export default openAi
