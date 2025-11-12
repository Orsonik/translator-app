const { BlobServiceClient } = require("@azure/storage-blob");

const storageAccountName = "translatorstoragepl";
const containerName = "source-files";
const sasToken = process.env.BLOB_SAS_TOKEN || "";

module.exports = async function (context, req) {
    context.log('Get files function processed a request.');

    try {
        if (!sasToken) {
            context.log.error('Missing SAS token');
            context.res = {
                status: 200,
                body: { files: [] }
            };
            return;
        }

        // Use SAS token
        const blobServiceClient = new BlobServiceClient(
            `https://${storageAccountName}.blob.core.windows.net?${sasToken}`
        );
        const containerClient = blobServiceClient.getContainerClient(containerName);
        
        context.log('Listing blobs with SAS token...');
        
        const files = [];
        for await (const blob of containerClient.listBlobsFlat()) {
            files.push({
                fileName: blob.name,
                size: blob.properties.contentLength,
                uploadDate: blob.properties.lastModified,
                status: 'uploaded',
                blobUrl: `https://${storageAccountName}.blob.core.windows.net/${containerName}/${blob.name}`
            });
        }

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
