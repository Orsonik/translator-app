const { CosmosClient } = require("@azure/cosmos");

const cosmosEndpoint = process.env.COSMOS_ENDPOINT || "";
const cosmosKey = process.env.COSMOS_KEY || "";

module.exports = async function (context, req) {
    context.log('Get translations function processed a request.');

    try {
        // Temporarily return mock data (Cosmos DB disabled due to crypto error)
        const translations = [];
        
        context.res = {
            status: 200,
            body: { translations }
        };

    } catch (error) {
        context.log.error("Error fetching translations:", error);
        context.res = {
            status: 500,
            body: { error: error.message || "Internal server error" }
        };
    }
};
