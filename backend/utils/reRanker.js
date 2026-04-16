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

    console.log(`[Re-Ranker] Processing and scoring ${documents.length} documents using high-performance array batching...`);
    
    // Create an array of text strings for batch embedding
    const textBatch = documents.map(doc => {
        // Truncate to a reasonable character length to prevent OOM spikes on Render's 512MB RAM
        const summary = doc.summary ? doc.summary.substring(0, 800) : "";
        return `${doc.title}. ${summary}`;
    });

    const scoredDocuments = [];

    try {
        // Perform 1 highly-optimized vector projection via ONNX/WASM instead of 65 sequential loops
        const batchTensors = await embedder(textBatch, { pooling: 'mean', normalize: true });
        
        // batchTensors.data contains all dimensions flattened. We chunk it back into individual vectors.
        const embeddingSize = 384; // MiniLM-L6-v2 outputs 384 dimensions
        const flatData = Array.from(batchTensors.data);
        
        for (let i = 0; i < documents.length; i++) {
            const startIdx = i * embeddingSize;
            const docVector = flatData.slice(startIdx, startIdx + embeddingSize);
            
            const score = cosineSimilarity(queryVector, docVector);
            
            scoredDocuments.push({
                ...documents[i],
                relevanceScore: score
            });
        }
    } catch (error) {
        console.error(`[Error] Batch embedding failed due to payload constraints:`, error.message);
        // Fallback: Assign a flat score if embedding randomly crashes due to memory limits
        return documents.slice(0, topK).map(doc => ({ ...doc, relevanceScore: 0 }));
    }

    // 3. Sort by highest relevance score descending
    scoredDocuments.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // 4. Return only the top K (The precision step) with a strict Quality Threshold
    // We mandate a minimum 25% mathematical semantic similarity to the user's question.
    const MIN_THRESHOLD = 0.25; 
    const filteredDocuments = scoredDocuments.filter(doc => doc.relevanceScore >= MIN_THRESHOLD);
    
    // Fallback: If EVERYTHING completely failed the strict threshold, just return the absolute top 2
    // so the AI still has some marginal context to lean on instead of breaking.
    const finalSelection = filteredDocuments.length > 0 
        ? filteredDocuments.slice(0, topK) 
        : scoredDocuments.slice(0, 2);

    console.log(`[Re-Ranker] Filtering complete. Returning top ${finalSelection.length} highly relevant documents.`);
    
    return finalSelection;
}

module.exports = { rankDocuments, EmbeddingPipeline, cosineSimilarity };