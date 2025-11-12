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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFile = uploadFile;
const functions_1 = require("@azure/functions");
const storage_blob_1 = require("@azure/storage-blob");
const cosmos_1 = require("@azure/cosmos");
const parse_multipart_data_1 = __importDefault(require("parse-multipart-data"));
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || "";
const cosmosEndpoint = process.env.COSMOS_ENDPOINT || "";
const cosmosKey = process.env.COSMOS_KEY || "";
function uploadFile(request, context) {
    return __awaiter(this, void 0, void 0, function* () {
        context.log(`Http function processed request for url "${request.url}"`);
        try {
            const contentType = request.headers.get("content-type") || "";
            const bodyBuffer = yield request.arrayBuffer();
            const boundary = parse_multipart_data_1.default.getBoundary(contentType);
            const parts = parse_multipart_data_1.default.parse(Buffer.from(bodyBuffer), boundary);
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
            const blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(connectionString);
            const containerClient = blobServiceClient.getContainerClient("source-files");
            const blockBlobClient = containerClient.getBlockBlobClient(fileName);
            yield blockBlobClient.uploadData(fileBuffer, {
                blobHTTPHeaders: { blobContentType: file.type }
            });
            // Save metadata to Cosmos DB
            const cosmosClient = new cosmos_1.CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
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
            yield container.items.create(fileMetadata);
            return {
                status: 200,
                jsonBody: {
                    message: "File uploaded successfully",
                    fileName: fileName,
                    fileId: fileName
                }
            };
        }
        catch (error) {
            context.error("Error uploading file:", error);
            return {
                status: 500,
                jsonBody: { error: error.message || "Internal server error" }
            };
        }
    });
}
functions_1.app.http('uploadFile', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: uploadFile
});
//# sourceMappingURL=uploadFile.js.map