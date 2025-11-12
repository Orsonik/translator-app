const { CosmosClient } = require("@azure/cosmos");

const cosmosEndpoint = process.env.COSMOS_ENDPOINT || "";
const cosmosKey = process.env.COSMOS_KEY || "";

module.exports = async function (context, req) {
    context.log('Get translations function processed a request.');

    try {
        const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
        const database = cosmosClient.database("TranslationsDB");
        const container = database.container("Translations");

        const { resources: translations } = await container.items
            .query({
                query: "SELECT * FROM c ORDER BY c.timestamp DESC OFFSET 0 LIMIT 100"
            })
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
