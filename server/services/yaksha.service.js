import OpenAI from 'openai';
import crypto from 'crypto';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

const model = process.env.OPENAI_MODEL || 'llama-3.1-8b-instant';

export function generateHashId() {
  return crypto.randomBytes(4).toString('hex'); // 8 character hash
}

export async function evaluateAnswer(suggestedAnswer, officialAnswer, faqQuestion) {
  try {
    const prompt = `You are Yaksha, an strict FAQ moderation AI.
A user has submitted a suggested answer for an FAQ.
Your task is to evaluate the suggested answer compared to the current official answer.

FAQ Question: "${faqQuestion}"
Current Official Answer: "${officialAnswer}"
User's Suggested Answer: "${suggestedAnswer}"

Rules:
1. Is the suggested answer spam, offensive, or completely irrelevant? -> Decision: "spam"
2. Is the suggested answer factually correct AND strictly better/more comprehensive than the official answer? -> Decision: "approved"
3. If it is somewhat helpful but you are unsure, or if it is just a minor rephrase -> Decision: "admin_review"

Respond in JSON format only:
{
  "decision": "approved" | "admin_review" | "spam",
  "confidence": <number between 0.0 and 1.0>,
  "reasoning": "<brief explanation of your decision>"
}
`;

    const response = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    // Ensure decision is one of the allowed enum values
    if (!['approved', 'admin_review', 'spam'].includes(result.decision)) {
        result.decision = 'admin_review';
    }

    return {
      decision: result.decision,
      confidence: result.confidence,
      reasoning: result.reasoning
    };
  } catch (error) {
    console.error("Yaksha Evaluation Error:", error);
    // Graceful fallback
    return {
      decision: 'admin_review',
      confidence: 0.0,
      reasoning: `API Error: ${error.message}`
    };
  }
}
