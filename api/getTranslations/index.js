const { CosmosClient } = require("@azure/cosmos");

const cosmosEndpoint = process.env.COSMOS_ENDPOINT || "";
const cosmosKey = process.env.COSMOS_KEY || "";

module.exports = async function (context, req) {
    context.log('Get translations function processed a request.');

    try {
        const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
        const database = cosmosClient.database("TranslationsDB");
        const container = database.container("Translations");

        // Use TOP instead of OFFSET/LIMIT for Cosmos DB v3 compatibility
        const { resources: translations } = await container.items
            .query("SELECT TOP 100 * FROM c ORDER BY c.timestamp DESC")
            .fetchAll();

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
