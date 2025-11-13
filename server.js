const express = require('express');
const path = require('path');
const multer = require('multer');
const { DefaultAzureCredential } = require('@azure/identity');
const { BlobServiceClient, generateBlobSASQueryParameters, ContainerSASPermissions } = require('@azure/storage-blob');
const { CosmosClient } = require('@azure/cosmos');
const axios = require('axios');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const DocumentTranslator = require('@azure-rest/ai-document-translator').default;
const { AzureKeyCredential } = require('@azure/core-auth');

const app = express();
const port = process.env.PORT || 3000;

// Multer configuration for file uploads
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Middleware
app.use(express.json());

// Redirect root to translator app (BEFORE static files)
app.get('/', (req, res) => {
    res.redirect('/translator.html');
});

// Serve static files from root
app.use(express.static(__dirname));

// Azure configuration
const storageAccountName = 'translatorstoragepl';
const containerName = 'source-files';
const translatorKey = process.env.TRANSLATOR_KEY || '3a25a62508b44c0e9993f5fb01847896';
const translatorEndpoint = process.env.TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com';
const translatorRegion = process.env.TRANSLATOR_REGION || 'westeurope';
const cosmosEndpoint = process.env.COSMOS_ENDPOINT || 'https://translator-db-pl.documents.azure.com:443/';

// Document Translation configuration
const docTranslatorKey = process.env.DOC_TRANSLATOR_KEY;
const docTranslatorEndpoint = process.env.DOC_TRANSLATOR_ENDPOINT || 'https://westeurope.api.cognitive.microsoft.com/';

// Storage account key for SAS generation (from environment or Azure Key Vault)
const storageAccountKey = process.env.STORAGE_ACCOUNT_KEY;

// Initialize Azure clients with Managed Identity
let blobServiceClient;
let cosmosClient;
let container;
let documentTranslatorClient;

try {
    const credential = new DefaultAzureCredential();
    
    // Blob Storage client (with Managed Identity for User Delegation SAS)
    blobServiceClient = new BlobServiceClient(
        `https://${storageAccountName}.blob.core.windows.net`,
        credential
    );
    console.log('Blob Storage client initialized with Managed Identity');
    
    // Document Translation client
    documentTranslatorClient = DocumentTranslator(
        docTranslatorEndpoint,
        new AzureKeyCredential(docTranslatorKey)
    );
    
    // Cosmos DB client
    cosmosClient = new CosmosClient({
        endpoint: cosmosEndpoint,
        aadCredentials: credential
    });
    
    const database = cosmosClient.database('TranslationsDB');
    container = database.container('Translations');
    
    console.log('Azure clients initialized with Managed Identity');
    console.log('Document Translation client initialized');
} catch (error) {
    console.error('Error initializing Azure clients:', error.message);
}

// Helper function: Generate SAS URL for blob container using User Delegation Key
async function generateContainerSasUrl(containerName, permissions = 'racwdl') {
    const startsOn = new Date();
    const expiresOn = new Date();
    expiresOn.setHours(expiresOn.getHours() + 2); // 2 hours validity
    
    // Get user delegation key (uses Managed Identity, bypasses shared key policy)
    const userDelegationKey = await blobServiceClient.getUserDelegationKey(startsOn, expiresOn);
    
    const sasToken = generateBlobSASQueryParameters({
        containerName,
        permissions: ContainerSASPermissions.parse(permissions),
        startsOn,
        expiresOn,
        version: '2021-12-02'
    }, userDelegationKey, storageAccountName).toString();
    
    return `https://${storageAccountName}.blob.core.windows.net/${containerName}?${sasToken}`;
}

// Helper function: Start Document Translation job
async function startDocumentTranslation(sourceFileName, targetLanguage) {
    try {
        const timestamp = Date.now();
        const uniqueSourceFileName = `${timestamp}_${sourceFileName}`;
        
        // Copy file from source-files to source-docs container
        const sourceContainerClient = blobServiceClient.getContainerClient('source-files');
        const sourceBlobClient = sourceContainerClient.getBlobClient(sourceFileName);
        
        const docSourceContainerClient = blobServiceClient.getContainerClient('source-docs');
        const docSourceBlobClient = docSourceContainerClient.getBlockBlobClient(uniqueSourceFileName);
        
        // Copy blob
        const downloadResponse = await sourceBlobClient.download();
        const fileData = await streamToBuffer(downloadResponse.readableStreamBody);
        await docSourceBlobClient.upload(fileData, fileData.length);
        
        console.log('File copied to source-docs:', uniqueSourceFileName);
        
        // Generate SAS URLs (r=read, l=list, w=write, a=add, c=create, d=delete)
        // Source needs 'rl' (read + list) for Document Translation API
        const sourceUrl = await generateContainerSasUrl('source-docs', 'rl');
        const targetUrl = await generateContainerSasUrl('translated-docs', 'racwdl');
        
        console.log('Starting document translation...');
        console.log('Source URL:', sourceUrl.substring(0, 100) + '...');
        console.log('Target URL:', targetUrl.substring(0, 100) + '...');
        
        // Start translation using REST API
        const translationResponse = await axios({
            method: 'POST',
            url: 'https://westeurope.cognitiveservices.azure.com/translator/document/batches?api-version=2024-05-01',
            headers: {
                'Ocp-Apim-Subscription-Key': docTranslatorKey,
                'Content-Type': 'application/json'
            },
            data: {
                inputs: [{
                    source: {
                        sourceUrl: sourceUrl,
                        filter: {
                            prefix: uniqueSourceFileName
                        }
                    },
                    targets: [{
                        targetUrl: targetUrl,
                        language: targetLanguage
                    }]
                }]
            }
        });
        
        const operationLocation = translationResponse.headers['operation-location'];
        const jobId = operationLocation.split('/').pop().split('?')[0];
        console.log('Translation job started:', jobId);
        
        return {
            jobId,
            sourceFileName: uniqueSourceFileName,
            targetLanguage
        };
        
    } catch (error) {
        console.error('Error starting document translation:', error.response?.data || error.message);
        throw error;
    }
}

// In-memory job tracking (in production, use Redis or Cosmos DB)
const translationJobs = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Translate text endpoint
app.post('/api/translateText', async (req, res) => {
    console.log('Translate text request received');
    
    try {
        const { text, targetLanguage } = req.body;
        
        if (!text || !targetLanguage) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Call Azure Translator
        const response = await axios({
            baseURL: translatorEndpoint,
            url: '/translate',
            method: 'post',
            headers: {
                'Ocp-Apim-Subscription-Key': translatorKey,
                'Ocp-Apim-Subscription-Region': translatorRegion,
                'Content-type': 'application/json'
            },
            params: {
                'api-version': '3.0',
                'to': targetLanguage
            },
            data: [{
                'text': text
            }],
            responseType: 'json'
        });

        const translatedText = response.data[0].translations[0].text;
        const translationId = `trans_${Date.now()}`;

        // Save to Cosmos DB
        try {
            await container.items.create({
                id: translationId,
                originalText: text,
                translatedText: translatedText,
                sourceLanguage: 'auto',
                targetLanguage: targetLanguage,
                timestamp: new Date().toISOString()
            });
            console.log('Translation saved to Cosmos DB');
        } catch (cosmosError) {
            console.error('Cosmos DB save failed (non-critical):', cosmosError.message);
        }

        res.json({
            translatedText: translatedText,
            translationId: translationId
        });

    } catch (error) {
        console.error('Translation error:', error.message);
        res.status(500).json({ 
            error: error.message || 'Translation failed'
        });
    }
});

// Upload file endpoint
app.post('/api/uploadFile', upload.single('file'), async (req, res) => {
    console.log('Upload file request received');
    
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileName = req.file.originalname;
        const fileData = req.file.buffer;

        console.log('File parsed:', {
            fileName,
            size: fileData.length
        });

        // Upload to Blob Storage with Managed Identity
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);

        console.log('Uploading to blob storage with Managed Identity...');
        
        await blockBlobClient.upload(fileData, fileData.length, {
            blobHTTPHeaders: {
                blobContentType: req.file.mimetype || 'application/octet-stream'
            }
        });

        console.log('Upload successful:', fileName);

        res.json({
            message: 'File uploaded successfully',
            fileName: fileName,
            size: fileData.length,
            uploadDate: new Date().toISOString(),
            blobUrl: blockBlobClient.url
        });

    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ 
            error: error.message || 'Internal server error',
            message: 'Upload failed. Please check the file and try again.'
        });
    }
});

// Translate file endpoint
app.post('/api/translateFile', upload.single('file'), async (req, res) => {
    console.log('Translate file request received');
    
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const targetLanguage = req.body.targetLanguage || 'en';
        const fileName = req.file.originalname;
        const fileData = req.file.buffer;
        const fileExtension = fileName.split('.').pop().toLowerCase();

        console.log('File to translate:', {
            fileName,
            size: fileData.length,
            targetLanguage,
            extension: fileExtension
        });

        // Upload original file to source-files container
        try {
            const sourceContainerClient = blobServiceClient.getContainerClient(containerName);
            const timestamp = Date.now();
            const uniqueFileName = `${timestamp}_${fileName}`;
            const blockBlobClient = sourceContainerClient.getBlockBlobClient(uniqueFileName);
            
            await blockBlobClient.upload(fileData, fileData.length);
            console.log('Original file uploaded to source-files:', uniqueFileName);
        } catch (uploadError) {
            console.error('Failed to upload original file to storage:', uploadError.message);
            // Continue anyway - translation can still work
        }

        // Extract text from file based on type
        let textToTranslate = '';
        
        if (fileExtension === 'txt') {
            // Plain text file
            textToTranslate = fileData.toString('utf-8');
        } else if (fileExtension === 'docx' || fileExtension === 'doc') {
            // Word document
            console.log('Extracting text from DOCX...');
            const result = await mammoth.extractRawText({ buffer: fileData });
            textToTranslate = result.value;
            if (result.messages && result.messages.length > 0) {
                console.log('Mammoth warnings:', result.messages);
            }
        } else if (fileExtension === 'pdf') {
            // PDF document
            console.log('Extracting text from PDF...');
            const pdfData = await pdfParse(fileData);
            textToTranslate = pdfData.text;
        } else {
            return res.status(400).json({ 
                error: 'Unsupported file format',
                message: 'Supported formats: .txt, .doc, .docx, .pdf'
            });
        }

        console.log('Extracted text length:', textToTranslate.length);

        if (!textToTranslate || textToTranslate.trim().length === 0) {
            return res.status(400).json({
                error: 'No text extracted',
                message: 'The file appears to be empty or contains no extractable text.'
            });
        }

        // Azure Translator has a limit of ~50,000 characters per request
        // For large texts, we need to split and translate in chunks
        const maxChunkSize = 5000;
        let translatedText = '';
        
        if (textToTranslate.length <= maxChunkSize) {
            // Small text - translate in one request
            const response = await axios({
                baseURL: translatorEndpoint,
                url: '/translate',
                method: 'post',
                headers: {
                    'Ocp-Apim-Subscription-Key': translatorKey,
                    'Ocp-Apim-Subscription-Region': translatorRegion,
                    'Content-type': 'application/json'
                },
                params: {
                    'api-version': '3.0',
                    'to': targetLanguage
                },
                data: [{
                    'text': textToTranslate
                }],
                responseType: 'json'
            });

            translatedText = response.data[0].translations[0].text;
        } else {
            // Large text - split into chunks and translate
            console.log('Large text detected, splitting into chunks...');
            const chunks = [];
            for (let i = 0; i < textToTranslate.length; i += maxChunkSize) {
                chunks.push(textToTranslate.substring(i, i + maxChunkSize));
            }
            
            console.log(`Translating ${chunks.length} chunks...`);
            
            for (let i = 0; i < chunks.length; i++) {
                const response = await axios({
                    baseURL: translatorEndpoint,
                    url: '/translate',
                    method: 'post',
                    headers: {
                        'Ocp-Apim-Subscription-Key': translatorKey,
                        'Ocp-Apim-Subscription-Region': translatorRegion,
                        'Content-type': 'application/json'
                    },
                    params: {
                        'api-version': '3.0',
                        'to': targetLanguage
                    },
                    data: [{
                        'text': chunks[i]
                    }],
                    responseType: 'json'
                });
                
                translatedText += response.data[0].translations[0].text;
                console.log(`Chunk ${i + 1}/${chunks.length} translated`);
            }
        }

        console.log('Translation completed, text length:', translatedText.length);

        // Create translated file - always return as .txt since we extracted text
        const baseFileName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
        const timestamp = Date.now();
        const uniqueTranslatedFileName = `${timestamp}_translated_${targetLanguage}_${baseFileName}.txt`;
        const translatedBuffer = Buffer.from(translatedText, 'utf-8');

        // Upload translated file to Blob Storage
        try {
            const translatedContainerClient = blobServiceClient.getContainerClient('translated-files');
            const blockBlobClient = translatedContainerClient.getBlockBlobClient(uniqueTranslatedFileName);
            
            await blockBlobClient.upload(translatedBuffer, translatedBuffer.length, {
                blobHTTPHeaders: {
                    blobContentType: 'text/plain; charset=utf-8'
                }
            });
            
            console.log('Translated file uploaded to storage:', uniqueTranslatedFileName);
        } catch (storageError) {
            console.error('Failed to upload translated file to storage:', storageError.message);
        }

        // Save file translation record to Cosmos DB
        try {
            const translationRecord = {
                id: `file_${timestamp}`,
                type: 'file',
                originalFileName: fileName,
                translatedFileName: uniqueTranslatedFileName,
                sourceLanguage: 'auto',
                targetLanguage: targetLanguage,
                originalSize: fileData.length,
                translatedSize: translatedBuffer.length,
                textLength: textToTranslate.length,
                fileType: fileExtension,
                timestamp: new Date().toISOString()
            };

            await container.items.create(translationRecord);
            console.log('File translation record saved to Cosmos DB');
        } catch (dbError) {
            console.error('Failed to save translation record to Cosmos DB:', dbError.message);
        }

        // Return translated file
        res.set({
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': `attachment; filename="${uniqueTranslatedFileName}"`,
            'Content-Length': translatedBuffer.length
        });
        res.send(translatedBuffer);

        console.log('Translated file sent successfully');

    } catch (error) {
        console.error('Error translating file:', error);
        res.status(500).json({ 
            error: error.message || 'Internal server error',
            message: 'File translation failed. Please try again.'
        });
    }
});

// Get files list endpoint
app.get('/api/getFiles', async (req, res) => {
    console.log('Get files request received');
    
    try {
        const sourceFiles = [];
        const translatedFiles = [];
        
        // Get files from source-files container
        const sourceContainerClient = blobServiceClient.getContainerClient(containerName);
        console.log('Listing source files with Managed Identity...');
        
        for await (const blob of sourceContainerClient.listBlobsFlat()) {
            sourceFiles.push({
                fileName: blob.name,
                size: blob.properties.contentLength,
                uploadDate: blob.properties.lastModified,
                blobUrl: `https://${storageAccountName}.blob.core.windows.net/${containerName}/${blob.name}`
            });
        }

        // Get files from translated-files container (text-based translations)
        const translatedContainerClient = blobServiceClient.getContainerClient('translated-files');
        console.log('Listing translated files with Managed Identity...');
        
        for await (const blob of translatedContainerClient.listBlobsFlat()) {
            translatedFiles.push({
                fileName: blob.name,
                size: blob.properties.contentLength,
                uploadDate: blob.properties.lastModified,
                blobUrl: `https://${storageAccountName}.blob.core.windows.net/translated-files/${blob.name}`
            });
        }

        // Get files from translated-docs container (Document Translation API results)
        const translatedDocsClient = blobServiceClient.getContainerClient('translated-docs');
        console.log('Listing translated docs with Managed Identity...');
        
        for await (const blob of translatedDocsClient.listBlobsFlat()) {
            console.log('Found translated doc:', blob.name);
            translatedFiles.push({
                fileName: blob.name,
                size: blob.properties.contentLength,
                uploadDate: blob.properties.lastModified,
                blobUrl: `https://${storageAccountName}.blob.core.windows.net/translated-docs/${blob.name}`
            });
        }

        console.log('Total translated files (from both containers):', translatedFiles.length);
        // Group files: match translated files with their source files
        const fileGroups = [];
        
        sourceFiles.forEach(sourceFile => {
            // Extract original filename without timestamp
            const match = sourceFile.fileName.match(/^\d+_(.*)/);
            const originalName = match ? match[1] : sourceFile.fileName;
            
            // Find all translations for this file
            const translations = translatedFiles.filter(tf => {
                // Format 1: Text-based translations - timestamp_translated_LANG_originalname.txt
                const textTranslationMatch = tf.fileName.match(/^\d+_translated_([a-z]{2})_(.*?)\.txt$/);
                if (textTranslationMatch) {
                    const [, language, baseName] = textTranslationMatch;
                    const baseOriginalName = originalName.replace(/\.[^/.]+$/, '');
                    return baseName === baseOriginalName;
                }
                
                // Format 2: Document Translation API - LANG/timestamp_originalname.extension
                const docTranslationMatch = tf.fileName.match(/^([a-z]{2})\/(.+)$/);
                if (docTranslationMatch) {
                    const [, language, docFileName] = docTranslationMatch;
                    return docFileName === sourceFile.fileName;
                }
                
                return false;
            }).map(tf => {
                // Extract language from either format
                const textMatch = tf.fileName.match(/^\d+_translated_([a-z]{2})_(.*?)\.txt$/);
                const docMatch = tf.fileName.match(/^([a-z]{2})\//);
                
                return {
                    fileName: tf.fileName,
                    language: textMatch ? textMatch[1] : (docMatch ? docMatch[1] : 'unknown'),
                    size: tf.size,
                    uploadDate: tf.uploadDate,
                    blobUrl: tf.blobUrl
                };
            });

            fileGroups.push({
                originalFile: {
                    fileName: sourceFile.fileName,
                    displayName: originalName,
                    size: sourceFile.size,
                    uploadDate: sourceFile.uploadDate,
                    blobUrl: sourceFile.blobUrl
                },
                translations: translations
            });
        });

        // Sort by upload date (newest first)
        fileGroups.sort((a, b) => new Date(b.originalFile.uploadDate) - new Date(a.originalFile.uploadDate));

        console.log(`Found ${sourceFiles.length} source files and ${translatedFiles.length} translated files`);
        console.log(`Grouped into ${fileGroups.length} file groups`);

        res.json({ fileGroups });

    } catch (error) {
        console.error('Error fetching files:', error.message);
        res.json({ fileGroups: [], error: error.message });
    }
});

// Translate existing file from library
app.post('/api/translateExistingFile', async (req, res) => {
    console.log('Translate existing file request received');
    
    try {
        const { fileName, targetLanguage, preserveFormatting } = req.body;
        
        if (!fileName || !targetLanguage) {
            return res.status(400).json({ error: 'Missing fileName or targetLanguage' });
        }

        // Extract original filename and extension
        const match = fileName.match(/^\d+_(.*)/);
        const originalFileName = match ? match[1] : fileName;
        const fileExtension = originalFileName.split('.').pop().toLowerCase();

        console.log('Translating existing file:', fileName, 'to', targetLanguage, 'preserveFormatting:', preserveFormatting);

        // Check if we should use Document Translation API
        const useDocumentTranslation = preserveFormatting && (fileExtension === 'docx' || fileExtension === 'doc');

        if (useDocumentTranslation) {
            // Use Azure Document Translation API (async)
            console.log('Using Azure Document Translation API for formatting preservation');
            
            const jobInfo = await startDocumentTranslation(fileName, targetLanguage);
            
            // Store job info for status tracking
            translationJobs.set(jobInfo.jobId, {
                jobId: jobInfo.jobId,
                sourceFileName: fileName,
                displayFileName: originalFileName,
                targetLanguage: targetLanguage,
                status: 'NotStarted',
                createdAt: new Date().toISOString()
            });
            
            // Return job ID for polling
            return res.json({
                success: true,
                async: true,
                jobId: jobInfo.jobId,
                message: 'Translation job started. Use /api/translationStatus/:jobId to check progress.'
            });
        }

        // Original text-based translation (instant)
        console.log('Using text-based translation (instant)');

        // Download file from source-files container
        const sourceContainerClient = blobServiceClient.getContainerClient(containerName);
        const blobClient = sourceContainerClient.getBlobClient(fileName);
        
        const downloadResponse = await blobClient.download();
        const fileData = await streamToBuffer(downloadResponse.readableStreamBody);

        console.log('Downloaded file:', originalFileName, 'size:', fileData.length);

        // Extract text based on file type (same logic as uploadFile)
        let textToTranslate = '';
        
        if (fileExtension === 'txt') {
            textToTranslate = fileData.toString('utf-8');
        } else if (fileExtension === 'docx' || fileExtension === 'doc') {
            const result = await mammoth.extractRawText({ buffer: fileData });
            textToTranslate = result.value;
        } else if (fileExtension === 'pdf') {
            const pdfData = await pdfParse(fileData);
            textToTranslate = pdfData.text;
        } else {
            return res.status(400).json({ 
                error: 'Unsupported file format',
                message: 'Supported formats: .txt, .doc, .docx, .pdf'
            });
        }

        if (!textToTranslate || textToTranslate.trim().length === 0) {
            return res.status(400).json({
                error: 'No text extracted',
                message: 'The file appears to be empty or contains no extractable text.'
            });
        }

        console.log('Extracted text length:', textToTranslate.length);

        // Translate text (with chunking for large files)
        const maxChunkSize = 5000;
        let translatedText = '';
        
        if (textToTranslate.length <= maxChunkSize) {
            const response = await axios({
                baseURL: translatorEndpoint,
                url: '/translate',
                method: 'post',
                headers: {
                    'Ocp-Apim-Subscription-Key': translatorKey,
                    'Ocp-Apim-Subscription-Region': translatorRegion,
                    'Content-type': 'application/json'
                },
                params: {
                    'api-version': '3.0',
                    'to': targetLanguage
                },
                data: [{
                    'text': textToTranslate
                }],
                responseType: 'json'
            });

            translatedText = response.data[0].translations[0].text;
        } else {
            const chunks = [];
            for (let i = 0; i < textToTranslate.length; i += maxChunkSize) {
                chunks.push(textToTranslate.substring(i, i + maxChunkSize));
            }
            
            for (let i = 0; i < chunks.length; i++) {
                const response = await axios({
                    baseURL: translatorEndpoint,
                    url: '/translate',
                    method: 'post',
                    headers: {
                        'Ocp-Apim-Subscription-Key': translatorKey,
                        'Ocp-Apim-Subscription-Region': translatorRegion,
                        'Content-type': 'application/json'
                    },
                    params: {
                        'api-version': '3.0',
                        'to': targetLanguage
                    },
                    data: [{
                        'text': chunks[i]
                    }],
                    responseType: 'json'
                });
                
                translatedText += response.data[0].translations[0].text;
            }
        }

        console.log('Translation completed, text length:', translatedText.length);

        // Save translated file
        const baseFileName = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || originalFileName;
        const timestamp = Date.now();
        const translatedFileName = `${timestamp}_translated_${targetLanguage}_${baseFileName}.txt`;
        const translatedBuffer = Buffer.from(translatedText, 'utf-8');

        const translatedContainerClient = blobServiceClient.getContainerClient('translated-files');
        const blockBlobClient = translatedContainerClient.getBlockBlobClient(translatedFileName);
        
        await blockBlobClient.upload(translatedBuffer, translatedBuffer.length, {
            blobHTTPHeaders: {
                blobContentType: 'text/plain; charset=utf-8'
            }
        });
        
        console.log('Translated file saved:', translatedFileName);

        // Save to Cosmos DB
        const translationRecord = {
            id: `file_${timestamp}`,
            type: 'file',
            originalFileName: originalFileName,
            translatedFileName: translatedFileName,
            sourceLanguage: 'auto',
            targetLanguage: targetLanguage,
            originalSize: fileData.length,
            translatedSize: translatedBuffer.length,
            textLength: textToTranslate.length,
            fileType: fileExtension,
            timestamp: new Date().toISOString()
        };

        await container.items.create(translationRecord);
        console.log('File translation record saved to Cosmos DB');

        res.json({ 
            success: true,
            translatedFileName: translatedFileName,
            language: targetLanguage,
            message: 'File translated successfully'
        });

    } catch (error) {
        console.error('Error translating existing file:', error);
        res.status(500).json({ 
            error: error.message || 'Internal server error',
            message: 'File translation failed. Please try again.'
        });
    }
});

// Check status of async document translation
app.get('/api/translationStatus/:jobId', async (req, res) => {
    console.log('Translation status check:', req.params.jobId);
    
    try {
        const { jobId } = req.params;
        const jobInfo = translationJobs.get(jobId);
        
        if (!jobInfo) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Query Azure Document Translation API for status
        const statusResponse = await axios({
            method: 'GET',
            url: `https://westeurope.cognitiveservices.azure.com/translator/document/batches/${jobId}?api-version=2024-05-01`,
            headers: {
                'Ocp-Apim-Subscription-Key': docTranslatorKey
            }
        });

        const status = statusResponse.data;
        console.log('Job status:', status.status);
        
        // Log full response for debugging
        if (status.status === 'ValidationFailed' || status.status === 'Failed') {
            console.log('Job details:', JSON.stringify(status, null, 2));
        }

        // Update job info
        jobInfo.status = status.status;
        jobInfo.lastChecked = new Date().toISOString();

        if (status.status === 'Succeeded') {
            // Find translated file in translated-docs container
            const translatedDocsClient = blobServiceClient.getContainerClient('translated-docs');
            
            for await (const blob of translatedDocsClient.listBlobsFlat()) {
                if (blob.name.includes(jobInfo.targetLanguage)) {
                    jobInfo.translatedFileName = blob.name;
                    jobInfo.translatedBlobUrl = `https://${storageAccountName}.blob.core.windows.net/translated-docs/${blob.name}`;
                    break;
                }
            }

            return res.json({
                status: 'completed',
                jobId: jobId,
                progress: 100,
                translatedFileName: jobInfo.translatedFileName,
                message: 'Translation completed successfully'
            });
        } else if (status.status === 'Failed' || status.status === 'ValidationFailed') {
            return res.json({
                status: 'failed',
                jobId: jobId,
                error: status.error || status.message || 'Translation failed',
                details: status,
                message: 'Translation job failed'
            });
        } else {
            // Running, NotStarted, Cancelling, etc.
            const progress = Math.min(90, (status.documentsSucceeded || 0) * 100);
            
            return res.json({
                status: 'processing',
                jobId: jobId,
                progress: progress,
                message: `Translation in progress: ${status.status}`
            });
        }

    } catch (error) {
        console.error('Error checking translation status:', error.response?.data || error.message);
        res.status(500).json({ 
            error: error.message,
            message: 'Failed to check translation status'
        });
    }
});

// Helper function to convert stream to buffer
async function streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on('data', (data) => {
            chunks.push(data instanceof Buffer ? data : Buffer.from(data));
        });
        readableStream.on('end', () => {
            resolve(Buffer.concat(chunks));
        });
        readableStream.on('error', reject);
    });
}

// Get translations history endpoint
app.get('/api/getTranslations', async (req, res) => {
    console.log('Get translations request received');
    
    try {
        const querySpec = {
            query: 'SELECT TOP 100 * FROM c ORDER BY c.timestamp DESC'
        };

        const { resources: translations } = await container.items
            .query(querySpec)
            .fetchAll();

        console.log(`Retrieved ${translations.length} translations`);

        res.json({ translations });

    } catch (error) {
        console.error('Error fetching translations:', error.message);
        res.json({ translations: [] });
    }
});

// Download file from storage
app.get('/api/downloadFile', async (req, res) => {
    console.log('Download file request received');
    
    try {
        const { fileName, container: containerType } = req.query;
        
        if (!fileName || !containerType) {
            return res.status(400).json({ error: 'Missing fileName or container parameter' });
        }

        console.log('Downloading file:', fileName, 'from container:', containerType);

        const containerClient = blobServiceClient.getContainerClient(containerType);
        const blobClient = containerClient.getBlobClient(fileName);
        
        const downloadResponse = await blobClient.download();
        const fileData = await streamToBuffer(downloadResponse.readableStreamBody);
        
        // Get content type
        const properties = await blobClient.getProperties();
        const contentType = properties.contentType || 'application/octet-stream';
        
        // Extract display name (remove timestamp prefix if present)
        const match = fileName.match(/^\d+_(.*)/);
        const displayName = match ? match[1] : fileName;

        res.set({
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${displayName}"`,
            'Content-Length': fileData.length
        });
        res.send(fileData);

        console.log('File downloaded successfully:', displayName);

    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({ 
            error: error.message || 'Internal server error',
            message: 'File download failed. Please try again.'
        });
    }
});

// Delete file and its translations
app.delete('/api/deleteFile', async (req, res) => {
    console.log('Delete file request received');
    
    try {
        const { fileName } = req.body;
        
        if (!fileName) {
            return res.status(400).json({ error: 'Missing fileName parameter' });
        }

        console.log('Deleting file:', fileName);

        // Delete original file from source-files
        const sourceContainerClient = blobServiceClient.getContainerClient(containerName);
        const sourceBlobClient = sourceContainerClient.getBlobClient(fileName);
        await sourceBlobClient.deleteIfExists();
        console.log('Deleted original file:', fileName);

        // Find and delete all translations
        const translatedContainerClient = blobServiceClient.getContainerClient('translated-files');
        
        // Extract original filename without timestamp
        const match = fileName.match(/^\d+_(.*)/);
        const originalName = match ? match[1] : fileName;
        const baseOriginalName = originalName.replace(/\.[^/.]+$/, ''); // Remove extension
        
        let deletedTranslations = 0;
        for await (const blob of translatedContainerClient.listBlobsFlat()) {
            // Check if this translation belongs to the deleted file
            const translatedMatch = blob.name.match(/^\d+_translated_([a-z]{2})_(.*?)\.txt$/);
            if (translatedMatch) {
                const [, language, baseName] = translatedMatch;
                if (baseName === baseOriginalName) {
                    const translatedBlobClient = translatedContainerClient.getBlobClient(blob.name);
                    await translatedBlobClient.deleteIfExists();
                    deletedTranslations++;
                    console.log('Deleted translation:', blob.name);
                }
            }
        }

        console.log(`Deleted ${deletedTranslations} translations`);

        res.json({ 
            success: true,
            message: `File deleted successfully along with ${deletedTranslations} translation(s)`
        });

    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ 
            error: error.message || 'Internal server error',
            message: 'File deletion failed. Please try again.'
        });
    }
});

// Redirect root to translator app
app.get('/', (req, res) => {
    res.redirect('/translator.html');
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
