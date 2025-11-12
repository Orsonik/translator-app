const { BlobServiceClient } = require("@azure/storage-blob");
const { DefaultAzureCredential } = require("@azure/identity");

const storageAccountName = "translatorstoragepl";
const containerName = "source-files";
const storageAccountUrl = `https://${storageAccountName}.blob.core.windows.net`;

module.exports = async function (context, req) {
    context.log('Get files function processed a request.');

    try {
        // Use Managed Identity for authentication
        const credential = new DefaultAzureCredential();
        const blobServiceClient = new BlobServiceClient(storageAccountUrl, credential);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        
        context.log('Listing blobs with Managed Identity...');
        
        const files = [];
        for await (const blob of containerClient.listBlobsFlat()) {
            files.push({
                fileName: blob.name,
                size: blob.properties.contentLength,
                uploadDate: blob.properties.lastModified,
                status: 'uploaded',
                blobUrl: `${storageAccountUrl}/${containerName}/${blob.name}`
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
