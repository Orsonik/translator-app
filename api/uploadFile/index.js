const { BlobServiceClient } = require("@azure/storage-blob");
const { CosmosClient } = require("@azure/cosmos");
const parseMultipart = require("parse-multipart-data");

const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || "";
const cosmosEndpoint = process.env.COSMOS_ENDPOINT || "";
const cosmosKey = process.env.COSMOS_KEY || "";

module.exports = async function (context, req) {
    context.log('Upload file function processed a request.');

    try {
        const contentType = req.headers['content-type'] || '';
        
        if (!contentType.includes('multipart/form-data')) {
            context.res = {
                status: 400,
                body: { error: "Request must be multipart/form-data" }
            };
            return;
        }

        // Parse multipart data
        const boundary = contentType.split('boundary=')[1];
        const parts = parseMultipart.parse(req.body, boundary);
        
        if (!parts || parts.length === 0) {
            context.res = {
                status: 400,
                body: { error: "No file uploaded" }
            };
            return;
        }

        const file = parts[0];
        const fileName = file.filename;
        const fileData = file.data;

        // Upload to Blob Storage
        const blobServiceClient = BlobServiceClient.fromConnectionString(storageConnectionString);
        const containerClient = blobServiceClient.getContainerClient("source-files");
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);

        await blockBlobClient.upload(fileData, fileData.length);

        // Save metadata to Cosmos DB
        const cosmosClient = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
        const database = cosmosClient.database("TranslationsDB");
        const container = database.container("Files");

        const fileRecord = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            fileName: fileName,
            uploadDate: new Date().toISOString(),
            size: fileData.length,
            status: "uploaded",
            blobUrl: blockBlobClient.url
        };

        await container.items.create(fileRecord);

        context.res = {
            status: 200,
            body: {
                message: "File uploaded successfully",
                fileName: fileName,
                fileId: fileRecord.id
            }
        };

    } catch (error) {
        context.log.error("Error uploading file:", error);
        context.res = {
            status: 500,
            body: { error: error.message || "Internal server error" }
        };
    }
};
