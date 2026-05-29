/**
 * Yaksha Evaluation Service
 * 
 * The intelligent gatekeeper for community answers.
 * Compares submitted answers against official FAQ + approved history + spam patterns.
 * Returns: { decision: 'approved'|'spam'|'unclear', confidence: 0.0-1.0, reasoning: string }
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Evaluate a community-submitted answer using Yaksha (OpenAI gpt-4o-mini).
 * 
 * @param {string} submittedText - The user's submitted answer
 * @param {string} officialAnswer - The existing official FAQ answer
 * @param {string} officialQuestion - The FAQ question being answered
 * @param {Array} approvedHistory - Previously approved community answers [{ answer_text, username }]
 * @returns {Promise<{decision: string, confidence: number, reasoning: string}>}
 */
export async function evaluateAnswer(submittedText, officialAnswer, officialQuestion, approvedHistory = []) {
  // Build context for Yaksha
  const historyContext = approvedHistory.length > 0
    ? approvedHistory.map((a, i) => `  Approved Answer #${i + 1} (by ${a.username || 'anonymous'}): "${a.answer_text}"`).join('\n')
    : '  No previous community answers.';

  const systemPrompt = `You are Yaksha, the AI gatekeeper for the Samagama FAQ community platform.

Your job: Evaluate a user-submitted community answer and decide if it should be shown to other users.

You must return a JSON object with exactly these fields:
- "decision": one of "approved", "spam", or "unclear"
- "confidence": a number between 0.0 and 1.0
- "reasoning": a brief explanation (1-2 sentences)

DECISION RULES:
1. "approved" (confidence >= 0.80): Answer is relevant, adds value, doesn't contradict the official answer, and isn't a duplicate of existing answers.
2. "spam" (confidence >= 0.85): Answer is gibberish, promotional, off-topic, copy-paste of official answer, abusive, or clearly not a genuine attempt to help.
3. "unclear" (confidence 0.60-0.80): Answer might be relevant but you're unsure — contains partial info, slightly contradicts official answer, or is borderline quality.

SPAM PATTERNS TO DETECT:
- Exact or near-duplicate of the official answer (copy-paste)
- Exact or near-duplicate of a previously approved answer
- Contains URLs, promotions, or advertising
- Gibberish, random characters, or very short non-answers (under 15 chars)
- Abusive or inappropriate language
- Completely off-topic (answer has nothing to do with the question)

RESPOND ONLY WITH VALID JSON. No markdown, no code blocks, no explanation outside the JSON.`;

  const userPrompt = `FAQ Question: "${officialQuestion}"

Official Answer: "${officialAnswer}"

Previously Approved Community Answers:
${historyContext}

NEW Submitted Answer to Evaluate:
"${submittedText}"

Evaluate this submission and return your decision as JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 200,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const raw = response.choices[0].message.content.trim();

    // Parse the JSON response
    let parsed;
    try {
      // Handle potential markdown code block wrapping
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[Yaksha] Failed to parse LLM response:', raw);
      // Default to unclear if parsing fails
      return {
        decision: 'unclear',
        confidence: 0.5,
        reasoning: 'Yaksha could not process this answer. Flagged for admin review.',
      };
    }

    // Validate and normalize the response
    const validDecisions = ['approved', 'spam', 'unclear'];
    const decision = validDecisions.includes(parsed.decision) ? parsed.decision : 'unclear';
    const confidence = typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5;
    const reasoning = typeof parsed.reasoning === 'string'
      ? parsed.reasoning
      : 'No reasoning provided.';

    return { decision, confidence, reasoning };
  } catch (err) {
    console.error('[Yaksha] OpenAI API error:', err.message);
    // If API fails, default to unclear (admin reviews)
    return {
      decision: 'unclear',
      confidence: 0.5,
      reasoning: 'Yaksha service unavailable. Flagged for manual admin review.',
    };
  }
}

export default { evaluateAnswer };
