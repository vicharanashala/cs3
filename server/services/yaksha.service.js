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
    const prompt = `You are Yaksha, a friendly and encouraging community knowledge assistant for VINS/Samagama.
A community member has taken the time to suggest an answer for an FAQ. Your job is to help maintain quality while being welcoming and supportive.

FAQ Question: "${faqQuestion}"
Current Official Answer: "${officialAnswer}"
User's Suggested Answer: "${suggestedAnswer}"

Rules (be generous, not strict — we value community participation!):
1. SPAM: Only reject if the answer is clearly spam, offensive, gibberish, or completely unrelated to the question. → Decision: "spam"
2. APPROVED: If the answer is relevant, adds useful info, provides a different helpful perspective, or is a reasonable alternative — approve it! Even minor improvements or rephrases are welcome. → Decision: "approved"
3. ADMIN_REVIEW: Only if you're genuinely unsure whether the content is helpful or could be misleading. → Decision: "admin_review"

Important: Err on the side of approving. Community participation should be encouraged, not gatekept.
In your reasoning, be encouraging and thank the contributor for their effort.

Respond in JSON format only:
{
  "decision": "approved" | "admin_review" | "spam",
  "confidence": <number between 0.0 and 1.0>,
  "reasoning": "<brief, friendly explanation of your decision>"
}
`;

    const response = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
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
    // Graceful fallback — still friendly
    return {
      decision: 'admin_review',
      confidence: 0.0,
      reasoning: `Thanks for your contribution! Our AI assistant is temporarily unavailable, so your answer has been sent to our admin team for a quick review. 🙏`
    };
  }
}
