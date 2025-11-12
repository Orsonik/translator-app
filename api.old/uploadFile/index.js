const { ContainerClient } = require("@azure/storage-blob");
const parseMultipart = require("parse-multipart-data");

const storageAccountName = "translatorstoragepl";
const containerName = "source-files";
const sasToken = process.env.BLOB_SAS_TOKEN || "";

module.exports = async function (context, req) {
    context.log('Upload file function processed a request.');

    try {
        if (!sasToken) {
            context.log.error('Missing SAS token');
            context.res = {
                status: 200,
                body: { 
                    error: "Storage not configured",
                    message: "Please configure BLOB_SAS_TOKEN"
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

        // Parse multipart data
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

        context.log('File parsed:', {
            fileName,
            size: fileData.length
        });

        // Use container-level SAS token - direct ContainerClient
        const containerUrl = `https://${storageAccountName}.blob.core.windows.net/${containerName}?${sasToken}`;
        const containerClient = new ContainerClient(containerUrl);
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);

        context.log('Uploading to blob storage with container SAS token...');
        
        await blockBlobClient.upload(fileData, fileData.length, {
            blobHTTPHeaders: {
                blobContentType: file.type || 'application/octet-stream'
            }
        });

        context.log('Upload successful:', fileName);

        context.res = {
            status: 200,
            body: {
                message: "File uploaded successfully",
                fileName: fileName,
                size: fileData.length,
                uploadDate: new Date().toISOString(),
                blobUrl: blockBlobClient.url
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
