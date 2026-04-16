// backend/services/researchFetcher.js
const axios = require('axios');
const xml2js = require('xml2js');

function reconstructOpenAlexAbstract(invertedIndex) {
    if (!invertedIndex) return "No abstract available.";
    try {
        const wordsArray = [];
        for (const [word, positions] of Object.entries(invertedIndex)) {
            positions.forEach(pos => {
                wordsArray[pos] = word;
            });
        }
        return wordsArray.filter(Boolean).join(" ");
    } catch (error) {
        console.error("Error reconstructing OpenAlex abstract:", error.message);
        return "Error parsing abstract.";
    }
}

async function fetchClinicalTrials(diseaseCondition, size = 20) {
    console.log(`[Fetch] Starting ClinicalTrials.gov for condition: ${diseaseCondition}`);
    try {
        const url = `https://clinicaltrials.gov/api/v2/studies?query.cond=${encodeURIComponent(diseaseCondition)}&filter.overallStatus=RECRUITING&pageSize=${size}&format=json`;
        const response = await axios.get(url, { timeout: 4500 });
        
        if (!response.data.studies) return [];

        return response.data.studies.map(study => {
            const protocol = study.protocolSection;
            return {
                source: 'ClinicalTrials.gov',
                title: protocol?.identificationModule?.officialTitle || protocol?.identificationModule?.briefTitle || "Unknown Title",
                status: protocol?.statusModule?.overallStatus || "Unknown Status",
                conditions: protocol?.conditionsModule?.conditions || [],
                eligibility: protocol?.eligibilityModule?.eligibilityCriteria || "Criteria not specified.",
                url: `https://clinicaltrials.gov/study/${protocol?.identificationModule?.nctId}`,
                summary: protocol?.descriptionModule?.briefSummary || "No summary provided."
            };
        });
    } catch (error) {
        console.error("[Error] ClinicalTrials fetch failed or timed out:", error.message);
        return []; 
    }
}

async function fetchOpenAlex(query, size = 25) {
    console.log(`[Fetch] Starting OpenAlex for query: ${query}`);
    try {
        const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=${size}&page=1&sort=relevance_score:desc`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Curalink-Hackathon-Project/1.0' },
            timeout: 4500 
        });
        
        if (!response.data.results) return [];

        return response.data.results.map(work => ({
            source: 'OpenAlex',
            title: work.title || "Unknown Title",
            year: work.publication_year || "Unknown Year",
            authors: work.authorships ? work.authorships.map(a => a.author.display_name).slice(0, 3).join(", ") : "Unknown Authors",
            url: work.id,
            summary: reconstructOpenAlexAbstract(work.abstract_inverted_index)
        }));
    } catch (error) {
        console.error("[Error] OpenAlex fetch failed:", error.message);
        return [];
    }
}

async function fetchPubMed(query, size = 20) {
    console.log(`[Fetch] Starting PubMed for query: ${query}`);
    try {
        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${size}&sort=pub+date&retmode=json`;
        const searchRes = await axios.get(searchUrl, { timeout: 4500 });
        const ids = searchRes.data.esearchresult?.idlist;

        if (!ids || ids.length === 0) return [];

        const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(',')}&retmode=xml`;
        const fetchRes = await axios.get(fetchUrl, { timeout: 5000 });
        
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(fetchRes.data);
        
        let articles = result.PubmedArticleSet.PubmedArticle;
        if (!articles) return [];
        if (!Array.isArray(articles)) articles = [articles]; 

        return articles.map(article => {
            const medline = article.MedlineCitation;
            const articleData = medline?.Article;
            
            let abstractText = "No abstract available.";
            if (articleData?.Abstract?.AbstractText) {
                const rawAbstract = articleData.Abstract.AbstractText;
                if (Array.isArray(rawAbstract)) {
                    abstractText = rawAbstract.map(t => typeof t === 'object' ? t._ : t).join(" ");
                } else if (typeof rawAbstract === 'object') {
                    abstractText = rawAbstract._ || "";
                } else {
                    abstractText = rawAbstract;
                }
            }

            let authors = "Unknown Authors";
            if (articleData?.AuthorList?.Author) {
                let authorArray = Array.isArray(articleData.AuthorList.Author) ? articleData.AuthorList.Author : [articleData.AuthorList.Author];
                authors = authorArray.map(a => `${a.LastName || ''} ${a.Initials || ''}`).slice(0, 3).join(", ");
            }

            let titleText = "Unknown Title";
            if (articleData?.ArticleTitle) {
                if (typeof articleData.ArticleTitle === 'object') {
                    titleText = articleData.ArticleTitle._ || "Unknown Title";
                } else {
                    titleText = articleData.ArticleTitle;
                }
            }

            return {
                source: 'PubMed',
                title: String(titleText),
                year: articleData?.Journal?.JournalIssue?.PubDate?.Year || "Unknown Year",
                authors: authors,
                url: `https://pubmed.ncbi.nlm.nih.gov/${medline?.PMID?._ || medline?.PMID}/`,
                summary: abstractText
            };
        });
    } catch (error) {
        console.error("[Error] PubMed fetch failed or timed out:", error.message);
        return [];
    }
}

async function gatherAllResearch(diseaseContext, expandedQuery) {
    console.log(`\n--- Starting Data Retrieval Pipeline ---`);
    console.log(`Condition: ${diseaseContext} | Expanded Query: ${expandedQuery}`);
    
    // REDUCED PAYLOAD SIZES: Fetching fewer docs dramatically speeds up both 
    // network transfer times and the local WASM re-ranking processing delay!
    const results = await Promise.allSettled([
        fetchClinicalTrials(diseaseContext, 10),
        fetchOpenAlex(expandedQuery, 10),
        fetchPubMed(expandedQuery, 8)
    ]);

    let combinedData = [];
    
    if (results[0].status === 'fulfilled') {
        console.log(`[Success] ClinicalTrials: ${results[0].value.length} trials fetched.`);
        combinedData.push(...results[0].value);
    }
    if (results[1].status === 'fulfilled') {
        console.log(`[Success] OpenAlex: ${results[1].value.length} works fetched.`);
        combinedData.push(...results[1].value);
    }
    if (results[2].status === 'fulfilled') {
        console.log(`[Success] PubMed: ${results[2].value.length} articles fetched.`);
        combinedData.push(...results[2].value);
    }

    console.log(`--- Retrieval Complete. Total Documents: ${combinedData.length} ---\n`);
    return combinedData;
}

module.exports = { gatherAllResearch };