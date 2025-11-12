const parseMultipart = require("parse-multipart-data");
const axios = require("axios");

const sasToken = process.env.AZURE_STORAGE_SAS_TOKEN || "";
const storageAccountName = "translatorstoragepl";
const containerName = "source-files";

module.exports = async function (context, req) {
    context.log('Upload file function processed a request.');

    try {
        // Check credentials
        if (!sasToken) {
            context.log.error('Missing SAS token');
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

        // Upload using REST API with SAS token (no crypto/SDK needed)
        const blobUrl = `https://${storageAccountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(fileName)}?${sasToken}`;
        
        context.log('Uploading to:', blobUrl.substring(0, 100) + '...');
        
        const response = await axios.put(blobUrl, fileData, {
            headers: {
                'x-ms-blob-type': 'BlockBlob',
                'Content-Type': file.type || 'application/octet-stream',
                'Content-Length': fileData.length
            }
        });

        context.log('Upload successful, status:', response.status);

        context.res = {
            status: 200,
            body: {
                message: "File uploaded successfully",
                fileName: fileName,
                size: fileData.length,
                uploadDate: new Date().toISOString()
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
