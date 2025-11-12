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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTranslations = getTranslations;
const functions_1 = require("@azure/functions");
const cosmos_1 = require("@azure/cosmos");
const cosmosEndpoint = process.env.COSMOS_ENDPOINT || "";
const cosmosKey = process.env.COSMOS_KEY || "";
function getTranslations(request, context) {
    return __awaiter(this, void 0, void 0, function* () {
        context.log(`Http function processed request for url "${request.url}"`);
        try {
            const cosmosClient = new cosmos_1.CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
            const database = cosmosClient.database("TranslationsDB");
            const container = database.container("Translations");
            const querySpec = {
                query: "SELECT * FROM c ORDER BY c.timestamp DESC OFFSET 0 LIMIT 100"
            };
            const { resources: translations } = yield container.items
                .query(querySpec)
                .fetchAll();
            return {
                status: 200,
                jsonBody: {
                    translations: translations,
                    count: translations.length
                }
            };
        }
        catch (error) {
            context.error("Error fetching translations:", error);
            return {
                status: 500,
                jsonBody: { error: error.message || "Internal server error" }
            };
        }
    });
}
functions_1.app.http('getTranslations', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: getTranslations
});
//# sourceMappingURL=getTranslations.js.map