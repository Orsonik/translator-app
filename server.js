const express = require('express');
const path = require('path');
const multer = require('multer');
const { DefaultAzureCredential } = require('@azure/identity');
const { BlobServiceClient } = require('@azure/storage-blob');
const { CosmosClient } = require('@azure/cosmos');
const axios = require('axios');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

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

// Initialize Azure clients with Managed Identity
let blobServiceClient;
let cosmosClient;
let container;

try {
    const credential = new DefaultAzureCredential();
    
    // Blob Storage client
    blobServiceClient = new BlobServiceClient(
        `https://${storageAccountName}.blob.core.windows.net`,
        credential
    );
    
    // Cosmos DB client
    cosmosClient = new CosmosClient({
        endpoint: cosmosEndpoint,
        aadCredentials: credential
    });
    
    const database = cosmosClient.database('TranslationsDB');
    container = database.container('Translations');
    
    console.log('Azure clients initialized with Managed Identity');
} catch (error) {
    console.error('Error initializing Azure clients:', error.message);
}

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
        const translatedFileName = `translated_${targetLanguage}_${baseFileName}.txt`;
        const translatedBuffer = Buffer.from(translatedText, 'utf-8');

        // Optional: Upload translated file to Blob Storage
        try {
            const translatedContainerClient = blobServiceClient.getContainerClient('translated-files');
            const blockBlobClient = translatedContainerClient.getBlockBlobClient(translatedFileName);
            
            await blockBlobClient.upload(translatedBuffer, translatedBuffer.length, {
                blobHTTPHeaders: {
                    blobContentType: 'text/plain; charset=utf-8'
                }
            });
            
            console.log('Translated file uploaded to storage:', translatedFileName);
        } catch (storageError) {
            console.error('Failed to upload translated file to storage (non-critical):', storageError.message);
        }

        // Return translated file
        res.set({
            'Content-Type': 'text/plain; charset=utf-8',
            'Content-Disposition': `attachment; filename="${translatedFileName}"`,
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
        const containerClient = blobServiceClient.getContainerClient(containerName);
        
        console.log('Listing blobs with Managed Identity...');
        
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

        console.log(`Found ${files.length} files`);

        res.json({ files });

    } catch (error) {
        console.error('Error fetching files:', error.message);
        res.json({ files: [], error: error.message });
    }
});

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
