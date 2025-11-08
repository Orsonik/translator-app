import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";
import axios from "axios";

const translatorKey = process.env.TRANSLATOR_KEY || "";
const translatorEndpoint = process.env.TRANSLATOR_ENDPOINT || "";
const translatorRegion = process.env.TRANSLATOR_REGION || "westeurope";
const cosmosEndpoint = process.env.COSMOS_ENDPOINT || "";
const cosmosKey = process.env.COSMOS_KEY || "";

export async function translateText(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    try {
        const body: any = await request.json();
        const { text, targetLanguage, sourceLanguage } = body;

        if (!text || !targetLanguage) {
            return {
                status: 400,
                jsonBody: { error: "Text and target language are required" }
            };
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

        // Save translation to Cosmos DB
        const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
        const database = cosmosClient.database("TranslationsDB");
        const container = database.container("Translations");

        const translationRecord = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            originalText: text,
            translatedText: translatedText,
            sourceLanguage: sourceLanguage || detectedLanguage?.language,
            targetLanguage: targetLanguage,
            timestamp: new Date().toISOString(),
            confidence: detectedLanguage?.score
        };

        await container.items.create(translationRecord);

        return {
            status: 200,
            jsonBody: {
                translatedText: translatedText,
                detectedLanguage: detectedLanguage,
                translationId: translationRecord.id
            }
        };

    } catch (error: any) {
        context.error("Error translating text:", error);
        return {
            status: 500,
            jsonBody: { error: error.message || "Internal server error" }
        };
    }
}

app.http('translateText', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: translateText
});
