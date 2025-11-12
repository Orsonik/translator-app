const axios = require("axios");

const sasToken = process.env.AZURE_STORAGE_SAS_TOKEN || "";
const storageAccountName = "translatorstoragepl";
const containerName = "source-files";

module.exports = async function (context, req) {
    context.log('Get files function processed a request.');

    try {
        // Check if SAS token is set
        if (!sasToken) {
            context.log.error('SAS token not configured');
            context.res = {
                status: 200,
                body: { files: [] }
            };
            return;
        }

        // List blobs using REST API (no crypto/SDK needed)
        const listUrl = `https://${storageAccountName}.blob.core.windows.net/${containerName}?${sasToken}&restype=container&comp=list`;
        
        context.log('Fetching files from:', listUrl.substring(0, 100) + '...');
        
        const response = await axios.get(listUrl);
        
        context.log('Response status:', response.status);
        
        // Parse XML response
        const xmlData = response.data;
        const blobMatches = xmlData.matchAll(/<Blob>([\s\S]*?)<\/Blob>/g);
        
        const files = [];
        for (const match of blobMatches) {
            const blobXml = match[1];
            const nameMatch = blobXml.match(/<Name>(.*?)<\/Name>/);
            const sizeMatch = blobXml.match(/<Content-Length>(\d+)<\/Content-Length>/);
            const dateMatch = blobXml.match(/<Last-Modified>(.*?)<\/Last-Modified>/);
            
            if (nameMatch) {
                files.push({
                    fileName: nameMatch[1],
                    size: sizeMatch ? parseInt(sizeMatch[1]) : 0,
                    uploadDate: dateMatch ? dateMatch[1] : new Date().toISOString(),
                    status: 'uploaded',
                    blobUrl: `https://${storageAccountName}.blob.core.windows.net/${containerName}/${nameMatch[1]}`
                });
            }
        }

        context.log(`Found ${files.length} files`);

        context.res = {
            status: 200,
            body: { files }
        };

    } catch (error) {
        context.log.error("Error fetching files:", error.message, error.response?.data || error.stack);
        // Return empty array instead of error to not break the UI
        context.res = {
            status: 200,
            body: { files: [], error: error.message }
        };
    }
};
