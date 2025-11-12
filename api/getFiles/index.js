const { CosmosClient } = require("@azure/cosmos");

const cosmosEndpoint = process.env.COSMOS_ENDPOINT || "";
const cosmosKey = process.env.COSMOS_KEY || "";

module.exports = async function (context, req) {
    context.log('Get files function processed a request.');

    try {
        // Temporarily return mock data (Cosmos DB disabled due to crypto error)
        const files = [];
        
        context.res = {
            status: 200,
            body: { files }
        };

    } catch (error) {
        context.log.error("Error fetching files:", error);
        context.res = {
            status: 500,
            body: { error: error.message || "Internal server error" }
        };
    }
};
