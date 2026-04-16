// backend/services/llmService.js
const { HfInference } = require('@huggingface/inference');

// Initialize the official Hugging Face SDK
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Switched to Qwen/Qwen2.5-7B-Instruct: Highly stable on the free tier, no license gate, and extremely smart.
const MODEL = 'Qwen/Qwen2.5-7B-Instruct';

function buildSystemPrompt(user, documents) {
    // We only send the TOP 4 documents to the LLM to prevent Context Limit errors on the free tier.
    const topDocsForLLM = documents.slice(0, 4);

    let contextString = topDocsForLLM.map((doc, index) => {
        // Truncate abstracts to 500 characters so the payload isn't massive
        let shortSummary = doc.summary ? doc.summary.substring(0, 500) + '...' : 'No summary available.';
        return `[Source ${index + 1}: ${doc.title} (${doc.source})] \nSummary: ${shortSummary}\n`;
    }).join('\n');

    return `You are Curalink, an AI Medical Research Assistant.
Patient: ${user.name}
Disease: ${user.diseaseOfInterest}.

RETRIEVED DATA:
${contextString}

RULES:
1. Act as a compassionate medical assistant.
2. DO NOT hallucinate. Use ONLY the RETRIEVED DATA above to inform factual answers.
3. If the user is asking a direct medical or research question, format your response in Markdown using these headings:
   - **Condition Overview**
   - **Research Insights**
   - **Clinical Trials**
   - **Source Attribution**
4. If the user is simply chatting, confirming (e.g. "Okay", "continue", "thanks"), or asking a quick conversational follow-up, reply naturally and conversationally without forcing the strict headings. Adapt your markdown structure contextually based on what the user is saying.`;
}

async function generateLLMResponse(user, chatHistory, latestMessage, topDocuments) {
    try {
        console.log(`[LLM] Constructing prompt and contacting Hugging Face Inference API via official SDK (Qwen)...`);
        
        const systemPrompt = buildSystemPrompt(user, topDocuments);
        
        // Construct the structured messages payload for the SDK
        const messages = [
            { role: "system", content: systemPrompt }
        ];
        
        // Add previous chat history (keep it to last 4 messages to save context window)
        const recentHistory = chatHistory.slice(-4);
        for (const msg of recentHistory) {
            messages.push({ role: msg.role, content: msg.content });
        }

        // Add the user's newest message
        messages.push({ role: "user", content: latestMessage });

        // Let the SDK natively handle the routing, formatting, and waking up of the model
        const response = await hf.chatCompletion({
            model: MODEL,
            messages: messages,
            max_tokens: 450,
            temperature: 0.3
        });

        console.log(`[LLM] Response generated successfully.`);
        
        if (response.choices && response.choices[0] && response.choices[0].message) {
            return response.choices[0].message.content.trim();
        } else {
            throw new Error("Unexpected response format from Hugging Face SDK.");
        }

    } catch (error) {
        console.error("[Error] LLM Generation failed:", error.message);
        return `I apologize, but my AI generation engine encountered an error: ${error.message}. However, you can view the highly relevant research articles I retrieved for you below.`;
    }
}

module.exports = { generateLLMResponse };