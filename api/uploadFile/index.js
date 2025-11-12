const { BlobServiceClient } = require("@azure/storage-blob");
const { CosmosClient } = require("@azure/cosmos");
const parseMultipart = require("parse-multipart-data");

const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || "";
const cosmosEndpoint = process.env.COSMOS_ENDPOINT || "";
const cosmosKey = process.env.COSMOS_KEY || "";

module.exports = async function (context, req) {
    context.log('Upload file function processed a request.');

    try {
        // Check credentials
        if (!storageConnectionString || !cosmosEndpoint || !cosmosKey) {
            context.log.error('Missing credentials:', {
                hasStorage: !!storageConnectionString,
                hasCosmos: !!cosmosEndpoint && !!cosmosKey
            });
            context.res = {
                status: 200,
                body: { 
                    error: "Service temporarily unavailable",
                    message: "Configuration is being updated. Please try again in a moment."
                }
            };
            return;
        }

        const contentType = req.headers['content-type'] || '';
        
        if (!contentType.includes('multipart/form-data')) {
            context.res = {
                status: 400,
                body: { error: "Request must be multipart/form-data" }
            };
            return;
        }

        // Parse multipart data - req.body for v3 is Buffer
        const boundary = contentType.split('boundary=')[1];
        const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
        const parts = parseMultipart.parse(bodyBuffer, boundary);
        
        if (!parts || parts.length === 0) {
            context.res = {
                status: 400,
                body: { error: "No file uploaded" }
            };
            return;
        }

        const file = parts[0];
        const fileName = file.filename || 'unnamed-file';
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
            status: 200,
            body: { 
                error: error.message || "Internal server error",
                message: "Upload failed. Please check the file and try again."
            }
        };
    }
};
