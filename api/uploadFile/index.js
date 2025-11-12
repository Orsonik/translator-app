const parseMultipart = require("parse-multipart-data");
const axios = require("axios");

const storageAccountName = "translatorstoragepl";
const storageAccountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY || "";
const containerName = "source-files";

module.exports = async function (context, req) {
    context.log('Upload file function processed a request.');

    try {
        // Check credentials
        if (!storageAccountKey) {
            context.log.error('Missing storage account key');
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

        // Upload using REST API with Shared Key (no crypto module needed for this)
        const blobUrl = `https://${storageAccountName}.blob.core.windows.net/${containerName}/${encodeURIComponent(fileName)}`;
        
        context.log('Uploading to blob storage...');
        context.log('File name:', fileName);
        context.log('File size:', fileData.length);
        
        // Create authorization header using simple string manipulation
        const date = new Date().toUTCString();
        const contentLength = fileData.length;
        const blobType = 'BlockBlob';
        const contentTypeHeader = file.type || 'application/octet-stream';
        
        // Build canonical headers
        const canonicalHeaders = `x-ms-blob-type:${blobType}\nx-ms-date:${date}\nx-ms-version:2021-08-06`;
        
        // Build canonical resource
        const canonicalResource = `/${storageAccountName}/${containerName}/${fileName}`;
        
        // Build string to sign
        const stringToSign = `PUT\n\n\n${contentLength}\n\n${contentTypeHeader}\n\n\n\n\n\n\n${canonicalHeaders}\n${canonicalResource}`;
        
        // Create signature using crypto (built-in Node.js module - should work in Azure Functions)
        const crypto = require('crypto');
        const signature = crypto.createHmac('sha256', Buffer.from(storageAccountKey, 'base64'))
            .update(stringToSign, 'utf8')
            .digest('base64');
        
        const authHeader = `SharedKey ${storageAccountName}:${signature}`;
        
        const response = await axios.put(blobUrl, fileData, {
            headers: {
                'Authorization': authHeader,
                'x-ms-blob-type': blobType,
                'x-ms-date': date,
                'x-ms-version': '2021-08-06',
                'Content-Type': contentTypeHeader,
                'Content-Length': contentLength
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
