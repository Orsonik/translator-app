import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { CosmosClient } from "@azure/cosmos";

const cosmosEndpoint = process.env.COSMOS_ENDPOINT || "";
const cosmosKey = process.env.COSMOS_KEY || "";

export async function getFiles(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    try {
        const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
        const database = cosmosClient.database("TranslationsDB");
        const container = database.container("Files");

        const querySpec = {
            query: "SELECT * FROM c ORDER BY c.uploadDate DESC"
        };

        const { resources: files } = await container.items
            .query(querySpec)
            .fetchAll();

        return {
            status: 200,
            jsonBody: {
                files: files,
                count: files.length
            }
        };

    } catch (error: any) {
        context.error("Error fetching files:", error);
        return {
            status: 500,
            jsonBody: { error: error.message || "Internal server error" }
        };
    }
}

app.http('getFiles', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: getFiles
});
