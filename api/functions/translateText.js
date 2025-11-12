"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateText = translateText;
const functions_1 = require("@azure/functions");
const cosmos_1 = require("@azure/cosmos");
const axios_1 = __importDefault(require("axios"));
const translatorKey = process.env.TRANSLATOR_KEY || "";
const translatorEndpoint = process.env.TRANSLATOR_ENDPOINT || "";
const translatorRegion = process.env.TRANSLATOR_REGION || "westeurope";
const cosmosEndpoint = process.env.COSMOS_ENDPOINT || "";
const cosmosKey = process.env.COSMOS_KEY || "";
function translateText(request, context) {
    return __awaiter(this, void 0, void 0, function* () {
        context.log(`Http function processed request for url "${request.url}"`);
        try {
            const body = yield request.json();
            const { text, targetLanguage, sourceLanguage } = body;
            if (!text || !targetLanguage) {
                return {
                    status: 400,
                    jsonBody: { error: "Text and target language are required" }
                };
            }
            // Call Azure Translator API
            const translateUrl = `${translatorEndpoint}/translate?api-version=3.0&to=${targetLanguage}${sourceLanguage ? `&from=${sourceLanguage}` : ''}`;
            const response = yield axios_1.default.post(translateUrl, [{ text }], {
                headers: {
                    'Ocp-Apim-Subscription-Key': translatorKey,
                    'Ocp-Apim-Subscription-Region': translatorRegion,
                    'Content-Type': 'application/json'
                }
            });
            const translation = response.data[0];
            const translatedText = translation.translations[0].text;
            const detectedLanguage = translation.detectedLanguage;
            // Save translation to Cosmos DB
            const cosmosClient = new cosmos_1.CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
            const database = cosmosClient.database("TranslationsDB");
            const container = database.container("Translations");
            const translationRecord = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                originalText: text,
                translatedText: translatedText,
                sourceLanguage: sourceLanguage || (detectedLanguage === null || detectedLanguage === void 0 ? void 0 : detectedLanguage.language),
                targetLanguage: targetLanguage,
                timestamp: new Date().toISOString(),
                confidence: detectedLanguage === null || detectedLanguage === void 0 ? void 0 : detectedLanguage.score
            };
            yield container.items.create(translationRecord);
            return {
                status: 200,
                jsonBody: {
                    translatedText: translatedText,
                    detectedLanguage: detectedLanguage,
                    translationId: translationRecord.id
                }
            };
        }
        catch (error) {
            context.error("Error translating text:", error);
            return {
                status: 500,
                jsonBody: { error: error.message || "Internal server error" }
            };
        }
    });
}
functions_1.app.http('translateText', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: translateText
});
//# sourceMappingURL=translateText.js.map