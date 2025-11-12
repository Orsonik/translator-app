const { CosmosClient } = require("@azure/cosmos");
const axios = require("axios");

const translatorKey = process.env.TRANSLATOR_KEY || "";
const translatorEndpoint = process.env.TRANSLATOR_ENDPOINT || "";
const translatorRegion = process.env.TRANSLATOR_REGION || "westeurope";
const cosmosEndpoint = process.env.COSMOS_ENDPOINT || "";
const cosmosKey = process.env.COSMOS_KEY || "";

module.exports = async function (context, req) {
    context.log('Translate text function processed a request.');

    // Debug: log environment variables (without exposing full keys)
    context.log('Environment check:', {
        hasTranslatorKey: !!translatorKey,
        hasTranslatorEndpoint: !!translatorEndpoint,
        hasCosmosEndpoint: !!cosmosEndpoint,
        hasCosmosKey: !!cosmosKey
    });

    try {
        const { text, targetLanguage, sourceLanguage } = req.body;

        if (!text || !targetLanguage) {
            context.res = {
                status: 400,
                body: { error: "Text and target language are required" }
            };
            return;
        }

        // Call Azure Translator API
        const translateUrl = `${translatorEndpoint}/translate?api-version=3.0&to=${targetLanguage}${sourceLanguage ? `&from=${sourceLanguage}` : ''}`;
        
        const response = await axios.post(
            translateUrl,
            [{ text }],
            {
                headers: {
                    'Ocp-Apim-Subscription-Key': translatorKey,
                    'Ocp-Apim-Subscription-Region': translatorRegion,
                    'Content-Type': 'application/json'
                }
            }
        );

        const translation = response.data[0];
        const translatedText = translation.translations[0].text;
        const detectedLanguage = translation.detectedLanguage;

        // Temporarily skip Cosmos DB to isolate the crypto error
        // Save translation to Cosmos DB
        // const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
        // const database = cosmosClient.database("TranslationsDB");
        // const container = database.container("Translations");

        const translationRecord = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            originalText: text,
            translatedText: translatedText,
            sourceLanguage: sourceLanguage || detectedLanguage?.language,
            targetLanguage: targetLanguage,
            timestamp: new Date().toISOString(),
            confidence: detectedLanguage?.score
        };

        // await container.items.create(translationRecord);
        context.log('Translation successful (Cosmos DB temporarily disabled)');

        context.res = {
            status: 200,
            body: {
                translatedText: translatedText,
                detectedLanguage: detectedLanguage,
                translationId: translationRecord.id
            }
        };

    } catch (error) {
        context.log.error("Error translating text:", error);
        context.res = {
            status: 500,
            body: { error: error.message || "Internal server error" }
        };
    }
};
