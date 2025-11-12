const { CosmosClient } = require("@azure/cosmos");

const cosmosEndpoint = process.env.COSMOS_ENDPOINT || "";
const cosmosKey = process.env.COSMOS_KEY || "";

module.exports = async function (context, req) {
    context.log('Get files function processed a request.');

    try {
        // Check if env vars are set
        if (!cosmosEndpoint || !cosmosKey) {
            context.log.error('Cosmos DB credentials not configured');
            context.res = {
                status: 200,
                body: { files: [] }
            };
            return;
        }

        const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
        const database = cosmosClient.database("TranslationsDB");
        const container = database.container("Files");

        const { resources: files } = await container.items
            .query("SELECT * FROM c ORDER BY c.uploadDate DESC")
            .fetchAll();

        context.log(`Found ${files.length} files`);

        context.res = {
            status: 200,
            body: { files }
        };

    } catch (error) {
        context.log.error("Error fetching files:", error.message, error.stack);
        // Return empty array instead of error to not break the UI
        context.res = {
            status: 200,
            body: { files: [], error: error.message }
        };
    }
};
