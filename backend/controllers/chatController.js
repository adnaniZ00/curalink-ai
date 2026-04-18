const User = require('../models/User');
const Chat = require('../models/Chat');
const { gatherAllResearch } = require('../services/researchFetcher');
const { rankDocuments, EmbeddingPipeline, cosineSimilarity } = require('../utils/reRanker');
const { generateLLMResponse } = require('../services/llmService');

const handleUserMessage = async (req, res) => {
    try {
        const { userId, message } = req.body;

        if (!userId || !message) {
            return res.status(400).json({ success: false, message: 'Missing userId or message content.' });
        }

        // 1. Fetch User Context
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User profile not found.' });
        }

        // 2. Fetch or Create Chat History
        let chatSession = await Chat.findOne({ userId });
        if (!chatSession) {
            chatSession = new Chat({ userId, messages: [] });
        }

        chatSession.messages.push({ role: 'user', content: message });
        await chatSession.save();

        console.log(`\n========================================`);
        console.log(`Processing new query for Patient: ${user.name}`);
        console.log(`Disease Context: ${user.diseaseOfInterest}`);

        // --- MATH-BASED INTENT DETECTION (Zero API calls) ---
        console.log(`[Routing] Analyzing semantic intent using local AI...`);
        const embedder = await EmbeddingPipeline.getInstance();
        
        // Fast tensor projections of mathematical anchors
        const anchorCasual = await embedder("Hello, thank you very much! Okay. Yes, I understand. That makes sense. See you later.", { pooling: 'mean', normalize: true });
        const anchorResearch = await embedder("What are the side effects of this surgery? Let me know about clinical trials. Research papers about my disease. Tell me more details.", { pooling: 'mean', normalize: true });
        
        const msgTensor = await embedder(message, { pooling: 'mean', normalize: true });
        
        const scoreCasual = cosineSimilarity(Array.from(msgTensor.data), Array.from(anchorCasual.data));
        const scoreResearch = cosineSimilarity(Array.from(msgTensor.data), Array.from(anchorResearch.data));
        
        // Final routing decision mathematically proven!
        const isConversational = scoreCasual > scoreResearch;

        let topDocuments = [];

        if (!isConversational) {
            // 3. Intelligent Query Formulation
            // Scientific databases (PubMed, OpenAlex) fail on conversational inputs.
            // We strip out stop words and question marks to create a clean Boolean keyword search.
            const stopWords = /\b(what|why|how|when|is|it|are|do|does|can|could|would|should|the|a|an|in|on|at|to|for|of|with|about|by|this|that|these|those|I|me|my|you|your|we|our)\b/gi;
            const cleanKeywords = message.replace(stopWords, '').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
            
            const databaseQuery = cleanKeywords.length > 2 
                ? `${user.diseaseOfInterest} AND ${cleanKeywords}` 
                : user.diseaseOfInterest;

            // 4. Data Retrieval (Depth)
            const rawDocuments = await gatherAllResearch(user.diseaseOfInterest, databaseQuery, cleanKeywords, user.location);

            // 5. Intelligent Re-Ranking (Precision)
            // Note: The Re-Ranker still uses the original, full user message for mathematical similarity scoring!
            topDocuments = await rankDocuments(message, rawDocuments, 8);
        } else {
            console.log(`[Routing] Detected conversational intent ("${message}"). Bypassing research pipeline.`);
        }

        // 6. The LLM Reasoning Step
        const llmResponseText = await generateLLMResponse(
            user, 
            chatSession.messages, // Pass history for multi-turn context
            message, 
            topDocuments
        );

        // 7. Save Assistant Response and strict Source Attribution to DB
        // If it was just a conversational reply, don't append sources
        const assistantMessage = {
            role: 'assistant',
            content: llmResponseText,
            sources: topDocuments.length > 0 ? topDocuments.map(doc => ({
                title: doc.title,
                url: doc.url,
                sourceType: doc.source,
                year: doc.year || new Date().getFullYear().toString()
            })) : []
        };

        chatSession.messages.push(assistantMessage);
        await chatSession.save();

        console.log(`========================================\n`);

        // 8. Return structured JSON to the React Frontend
        return res.status(200).json({
            success: true,
            response: assistantMessage.content,
            sources: assistantMessage.sources
        });

    } catch (error) {
        console.error("Error in handleUserMessage:", error);
        return res.status(500).json({ success: false, message: 'Internal server error processing chat.', error: error.message });
    }
};

module.exports = { handleUserMessage };