import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'placeholder-key-for-now',
});

export async function generateEmbedding(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input text: must be a non-empty string.');
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.trim(),
    });

    if (response && response.data && response.data[0] && response.data[0].embedding) {
      return response.data[0].embedding;
    } else {
      throw new Error('Unexpected response format from OpenAI Embeddings API.');
    }
  } catch (error) {
    console.error('OpenAI Embedding Error:', error);
    throw new Error(`Embedding Generation Failed: ${error.message}`);
  }
}

export default { generateEmbedding };
