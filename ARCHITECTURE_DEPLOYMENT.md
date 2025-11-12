# Azure Translator App - Architecture & Deployment

## 🏗️ Architecture Overview

### Technology Stack
- **Frontend**: Bootstrap 5 (Grayscale theme), Vanilla JavaScript
- **Backend**: Node.js 20 with Express.js
- **Container**: Docker (Alpine Linux)
- **Hosting**: Azure Container Apps (Consumption plan)
- **Container Registry**: Azure Container Registry (Basic tier)
- **Storage**: Azure Blob Storage (source-files, translated-files)
- **Database**: Azure Cosmos DB (TranslationsDB)
- **Translation**: Azure Translator Service (S1 tier)
- **CI/CD**: GitHub Actions

### Azure Resources

| Resource | Name | Location | SKU/Tier | Purpose |
|----------|------|----------|----------|---------|
| Container App | translator-app-ca | Poland Central | Consumption | Main application hosting |
| Container App Environment | translator-env | Poland Central | Consumption | Managed environment |
| Container Registry | translatorappacr | Poland Central | Basic | Docker image storage |
| Storage Account | translatorstoragepl | Poland Central | Standard_LRS | File upload storage |
| Cosmos DB | translator-db-pl | Poland Central | 400 RU/s | Translation history |
| Translator Service | translator-service-pl | West Europe | S1 | Text translation API |
| Resource Group | translator-rg | Poland Central | - | Resource container |

### Application URL
**Production**: `https://translator-app-ca.redforest-315670b8.polandcentral.azurecontainerapps.io/`

---

## 🔐 Security & Authentication

### Managed Identity
- **Principal ID**: `d4c1a272-1ac7-458a-9820-4a2d0fb9a449`
- **Type**: System-assigned
- **Tenant**: `0e456556-80eb-4a6f-9d1b-216d1118833e`

### Role Assignments
1. **Storage Blob Data Contributor** → `translatorstoragepl`
   - Allows read/write access to blob containers
   - No shared keys required
2. **Cosmos DB Built-in Data Contributor** → `translator-db-pl`
   - Full CRUD access to Cosmos DB
   - Role Definition: `00000000-0000-0000-0000-000000000002`

### Environment Variables (Container App)
```bash
TRANSLATOR_KEY=3a25a62508b44c0e9993f5fb01847896
TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com
TRANSLATOR_REGION=westeurope
COSMOS_ENDPOINT=https://translator-db-pl.documents.azure.com:443/
```

---

## 🚀 Deployment Process

### GitHub Actions Workflow

**Trigger**: Push to `main` branch or manual dispatch

**Steps**:
1. **Checkout** - Clone repository code
2. **Azure Login** - Authenticate with Service Principal
3. **Build & Push** - Build Docker image in ACR
   - Tag with commit SHA: `translator-app:${GITHUB_SHA}`
   - Tag with latest: `translator-app:latest`
4. **Deploy** - Update Container App with new image
5. **Logout** - Clean up Azure session

**Workflow File**: `.github/workflows/deploy-containerapp.yml`

### Service Principal Credentials
- **Name**: `translator-app-github-actions`
- **Client ID**: `e9ec575e-f886-4709-96b9-d19662eb0430`
- **Role**: Contributor (scoped to `translator-rg`)
- **GitHub Secret**: `AZURE_CREDENTIALS` (JSON format)

### Manual Deployment

#### Build Docker Image Locally
```bash
# Build image in ACR (cloud build)
az acr build --registry translatorappacr \
  --image translator-app:latest \
  .
```

#### Update Container App
```bash
# Deploy new version
az containerapp update \
  --name translator-app-ca \
  --resource-group translator-rg \
  --image translatorappacr.azurecr.io/translator-app:latest
```

#### View Logs
```bash
# Stream application logs
az containerapp logs show \
  --name translator-app-ca \
  --resource-group translator-rg \
  --follow

# View specific revision
az containerapp revision list \
  --name translator-app-ca \
  --resource-group translator-rg \
  --output table
```

---

## 📦 Docker Configuration

### Dockerfile Structure
```dockerfile
FROM node:20-alpine          # Base image (minimal)
WORKDIR /app                 # Working directory
COPY package*.json ./        # Dependency manifests
RUN npm ci --only=production # Install dependencies
COPY server.js ./            # Express server
COPY *.html ./               # HTML files
COPY assets ./assets         # Static assets
COPY css ./css               # Stylesheets
COPY js ./js                 # JavaScript
EXPOSE 3000                  # Application port
CMD ["node", "server.js"]    # Start command
```

### Image Layers
- **Base**: Node.js 20 Alpine (~150 MB)
- **Dependencies**: 158 npm packages (~30 MB)
- **Application**: HTML, CSS, JS, server.js (~5 MB)
- **Total Size**: ~185 MB

### .dockerignore
Excludes from build:
- `node_modules/` (installed during build)
- `.git/`, `.github/` (not needed in container)
- `api.old/` (legacy Azure Functions)
- `*.md`, `.env`, `.vscode/` (development files)

---

## 🔧 API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Redirect to `/translator.html` | None |
| GET | `/health` | Health check endpoint | None |
| POST | `/api/translateText` | Translate text using Azure Translator | None |
| POST | `/api/uploadFile` | Upload file to Blob Storage | MI |
| GET | `/api/getFiles` | List uploaded files | MI |
| GET | `/api/getTranslations` | Get translation history | MI |

**MI** = Uses Managed Identity for Azure resource access

---

## 🗄️ Data Storage

### Blob Storage Containers
1. **source-files** - User uploaded files
   - Access: Managed Identity (Storage Blob Data Contributor)
   - Public Access: Disabled
2. **translated-files** - Translated documents (future use)

### Cosmos DB Schema
**Database**: `TranslationsDB`
**Container**: `Translations`

```json
{
  "id": "trans_1699789234567",
  "originalText": "Hello world",
  "translatedText": "Hola mundo",
  "sourceLanguage": "auto",
  "targetLanguage": "es",
  "timestamp": "2025-11-12T10:30:00.000Z"
}
```

**Partition Key**: `/id`
**Throughput**: 400 RU/s (manual)

---

## 💰 Cost Estimation

### Monthly Costs (Approximate)

| Service | Configuration | Est. Cost |
|---------|--------------|-----------|
| Container Apps | Consumption, ~1GB RAM, minimal traffic | $10-20 |
| Container Registry | Basic tier, <10GB storage | $5 |
| Blob Storage | Standard LRS, <1GB | $0.50 |
| Cosmos DB | 400 RU/s manual | $24 |
| Translator Service | S1, ~10k chars/month | $10 |
| **Total** | | **~$50-60/month** |

**Free tier credits**: Container Apps includes 180,000 vCPU-seconds free per month

---

## 🔄 Migration History

### Previous Architecture: Static Web Apps
- **Platform**: Azure Static Web Apps (Standard tier, $9/month)
- **Functions**: Azure Functions v3 (JavaScript)
- **Limitations**:
  - Managed Identity not accessible from Functions
  - Crypto module unavailable (Node.js polyfills missing)
  - SAS token authentication required
  - Cosmos DB SDK v4 incompatible
  - Organizational policies blocked Shared Key Access

### Current Architecture: Container Apps
- **Benefits**:
  ✅ Full Managed Identity support
  ✅ Complete Node.js environment (crypto, all SDKs)
  ✅ No platform limitations
  ✅ Better scalability and performance
  ✅ Single deployment unit (frontend + backend)
  ✅ More control over runtime and configuration

---

## 🛠️ Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Set environment variables
export TRANSLATOR_KEY="your-key"
export TRANSLATOR_ENDPOINT="https://api.cognitive.microsofttranslator.com"
export TRANSLATOR_REGION="westeurope"
export COSMOS_ENDPOINT="https://translator-db-pl.documents.azure.com:443/"

# Run locally (requires Azure credentials)
npm start

# Access at http://localhost:3000
```

### Testing
```bash
# Health check
curl http://localhost:3000/health

# Translate text
curl -X POST http://localhost:3000/api/translateText \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello","targetLanguage":"pl"}'
```

### Git Workflow
```bash
# Make changes
git add .
git commit -m "Description of changes"
git push origin main

# Automatic deployment via GitHub Actions
# Monitor at: https://github.com/Orsonik/translator-app/actions
```

---

## 📊 Monitoring & Logging

### Log Analytics Workspace
- **Name**: `workspace-translatorrgyuZo`
- **Region**: Poland Central
- **Retention**: 30 days (default)

### Container App Logs
```bash
# View application logs
az containerapp logs show \
  --name translator-app-ca \
  --resource-group translator-rg \
  --tail 100

# Live log streaming
az containerapp logs show \
  --name translator-app-ca \
  --resource-group translator-rg \
  --follow
```

### Metrics to Monitor
- Request count and latency
- Container CPU/Memory usage
- HTTP 5xx errors
- Blob Storage operations
- Cosmos DB RU consumption

---

## 🔧 Troubleshooting

### Common Issues

**1. Container fails to start**
```bash
# Check revision status
az containerapp revision list \
  --name translator-app-ca \
  --resource-group translator-rg

# View container logs
az containerapp logs show \
  --name translator-app-ca \
  --resource-group translator-rg
```

**2. Managed Identity access denied**
```bash
# Verify role assignments
az role assignment list \
  --assignee d4c1a272-1ac7-458a-9820-4a2d0fb9a449 \
  --output table

# Re-assign if needed
az role assignment create \
  --assignee d4c1a272-1ac7-458a-9820-4a2d0fb9a449 \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/.../storageAccounts/translatorstoragepl
```

**3. GitHub Actions fails**
```bash
# Verify Service Principal
az ad sp show --id e9ec575e-f886-4709-96b9-d19662eb0430

# Check role assignment
az role assignment list \
  --assignee e9ec575e-f886-4709-96b9-d19662eb0430 \
  --scope /subscriptions/.../resourceGroups/translator-rg
```

**4. Image build fails**
```bash
# Check ACR build logs
az acr task logs --registry translatorappacr

# Manually build and test locally
docker build -t translator-app:test .
docker run -p 3000:3000 translator-app:test
```

---

## 📚 Additional Resources

- **Azure Container Apps Docs**: https://learn.microsoft.com/azure/container-apps/
- **Managed Identity**: https://learn.microsoft.com/azure/active-directory/managed-identities-azure-resources/
- **Azure SDK for JavaScript**: https://learn.microsoft.com/javascript/azure/
- **GitHub Actions for Azure**: https://github.com/Azure/actions

---

## 📝 Notes

- **Auto-scaling**: Configured for 1-10 replicas based on HTTP traffic
- **Cold start**: ~2-3 seconds on consumption plan
- **Deployment time**: ~2-3 minutes via GitHub Actions
- **Image registry**: Uses ACR admin credentials (can be changed to Managed Identity)
- **Health endpoint**: `/health` returns JSON with status and timestamp

---

**Last Updated**: November 12, 2025
**Maintained By**: Orson Sokolowski (msokolowski@microsoft.com)
