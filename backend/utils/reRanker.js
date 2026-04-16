// backend/utils/reRanker.js
const { pipeline, dot } = require('@xenova/transformers');

class EmbeddingPipeline {
    static task = 'feature-extraction';
    static model = 'Xenova/all-MiniLM-L6-v2'; // Fast, lightweight, standard for search
    static instance = null;

    static async getInstance() {
        if (this.instance === null) {
            console.log(`[AI Loading] Initializing local embedding model: ${this.model}...`);
            this.instance = await pipeline(this.task, this.model);
            console.log(`[AI Success] Local embedding model loaded into server memory.`);
        }
        return this.instance;
    }
}

/**
 * Mathematical helper: Calculates Cosine Similarity between two vectors.
 * Returns a score between -1 and 1 (1 means exact match).
 */
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Main Function: Ranks a massive list of documents against a user query.
 * @param {String} query - The user's question (e.g., "Latest lung cancer treatments")
 * @param {Array} documents - The massive array of fetched APIs (ClinicalTrials, PubMed, OpenAlex)
 * @param {Number} topK - How many final documents to return (Hackathon requires 6-8)
 */
async function rankDocuments(query, documents, topK = 8) {
    if (!documents || documents.length === 0) return [];

    console.log(`[Re-Ranker] Embedding user query: "${query}"...`);
    const embedder = await EmbeddingPipeline.getInstance();

    // 1. Convert the User's Query into a Mathematical Vector (Tensor)
    const queryTensor = await embedder(query, { pooling: 'mean', normalize: true });
    const queryVector = Array.from(queryTensor.data);

    console.log(`[Re-Ranker] Processing and scoring ${documents.length} documents...`);
    
    const scoredDocuments = [];

    // 2. Loop through every document, embed its summary, and calculate similarity
    for (const doc of documents) {
        // We use the title + summary for a richer embedding context
        const textToEmbed = `${doc.title}. ${doc.summary}`;
        
        try {
            const docTensor = await embedder(textToEmbed, { pooling: 'mean', normalize: true });
            const docVector = Array.from(docTensor.data);
            
            const score = cosineSimilarity(queryVector, docVector);
            
            scoredDocuments.push({
                ...doc,
                relevanceScore: score
            });
        } catch (error) {
            console.error(`[Error] Failed to embed document: ${doc.title.substring(0, 30)}...`, error.message);
            // If it fails, give it a baseline score so it isn't completely lost
            scoredDocuments.push({ ...doc, relevanceScore: 0 }); 
        }
    }

    // 3. Sort by highest relevance score descending
    scoredDocuments.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // 4. Return only the top K (The precision step)
    const finalSelection = scoredDocuments.slice(0, topK);
    console.log(`[Re-Ranker] Filtering complete. Returning top ${finalSelection.length} highly relevant documents.`);
    
    return finalSelection;
}

module.exports = { rankDocuments, EmbeddingPipeline, cosineSimilarity };