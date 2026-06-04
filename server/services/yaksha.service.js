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

export async function evaluateAnswer(suggestedAnswer, officialAnswer, faqQuestion, isQuery = false) {
  try {
    const prompt = `You are Yaksha, a quality-focused knowledge gatekeeper for VINS/Samagama.
A community member has submitted an answer for a question. Your job is to ensure only genuinely helpful, substantive answers get through.

Question: "${faqQuestion}"
${isQuery ? 'Context: This is an open community issue.' : `Current Official Answer: "${officialAnswer}"`}
User's Suggested Answer: "${suggestedAnswer}"

STRICT EVALUATION RULES — follow these precisely:

1. SPAM (Decision: "spam") — Reject if ANY of these apply:
   - The submission does NOT actually answer the question (e.g. greetings like "hi", "hello", "are you there", chat messages, questions back to the user)
   - The submission is fewer than 15 words AND does not contain specific, actionable information
   - The submission is gibberish, offensive, promotional, or completely off-topic
   - The submission is just a copy/paste of the question itself
   - The submission contains only generic filler like "yes", "no", "I agree", "same problem", "thanks"

2. APPROVED (Decision: "approved") — Approve ONLY if ALL of these are true:
   - The submission directly and substantively answers the question
   - The submission contains specific, useful information (steps, details, links, or concrete guidance)
   - The submission is at least a coherent paragraph or a clear set of instructions
   - The content is factually plausible and relevant to the VINS/Samagama context

3. ADMIN_REVIEW (Decision: "admin_review") — Use when:
   - The answer seems partially relevant but you are unsure of accuracy
   - The answer could be helpful but contains potentially misleading information
   - The answer is borderline on length/substance

CRITICAL: Do NOT approve short, vague, or non-answer submissions. Quality matters more than quantity. When in doubt, choose "admin_review" over "approved".

In your reasoning, be professional. Thank genuine contributors, but clearly explain rejections.

Respond in JSON format only:
{
  "decision": "approved" | "admin_review" | "spam",
  "confidence": <number between 0.0 and 1.0>,
  "reasoning": "<brief, professional explanation of your decision>"
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
