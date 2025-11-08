import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import { CosmosClient } from "@azure/cosmos";
import multipart from "parse-multipart-data";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || "";
const cosmosEndpoint = process.env.COSMOS_ENDPOINT || "";
const cosmosKey = process.env.COSMOS_KEY || "";

export async function uploadFile(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    try {
        const contentType = request.headers.get("content-type") || "";
        const bodyBuffer = await request.arrayBuffer();
        const boundary = multipart.getBoundary(contentType);
        const parts = multipart.parse(Buffer.from(bodyBuffer), boundary);

        if (!parts || parts.length === 0) {
            return {
                status: 400,
                body: JSON.stringify({ error: "No file uploaded" })
            };
        }

        const file = parts[0];
        const fileName = file.filename || `file-${Date.now()}`;
        const fileBuffer = file.data;

        // Upload to Blob Storage
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient("source-files");
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);

        await blockBlobClient.uploadData(fileBuffer, {
            blobHTTPHeaders: { blobContentType: file.type }
        });

        // Save metadata to Cosmos DB
        const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
        const database = cosmosClient.database("TranslationsDB");
        const container = database.container("Files");

        const fileMetadata = {
            id: fileName,
            fileName: fileName,
            originalName: file.filename,
            uploadDate: new Date().toISOString(),
            size: fileBuffer.length,
            status: "uploaded",
            translations: []
        };

        await container.items.create(fileMetadata);

        return {
            status: 200,
            jsonBody: {
                message: "File uploaded successfully",
                fileName: fileName,
                fileId: fileName
            }
        };

    } catch (error: any) {
        context.error("Error uploading file:", error);
        return {
            status: 500,
            jsonBody: { error: error.message || "Internal server error" }
        };
    }
}

app.http('uploadFile', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: uploadFile
});
