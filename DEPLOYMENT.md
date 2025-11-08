# Konfiguracja Projektu - Instrukcje Wdrożenia

## Status Zasobów Azure

### ✅ Utworzone zasoby:

| Zasób | Nazwa | Region | SKU/Tier | Status |
|-------|-------|--------|----------|--------|
| Resource Group | `translator-rg` | Poland Central | - | ✅ Active |
| Static Web App | `translator-app` | West Europe | Free | ✅ Active |
| Translator Service | `translator-service-pl` | West Europe | S1 | ✅ Active |
| Storage Account | `translatorstoragepl` | Poland Central | Standard_LRS | ✅ Active |
| Cosmos DB | `translator-db-pl` | Poland Central | Standard | ✅ Active |

### Storage Containers:
- `source-files` - pliki źródłowe do tłumaczenia
- `translated-files` - przetłumaczone pliki

### Cosmos DB:
- Database: `TranslationsDB`
- Container: `Files` (partition key: `/id`)
- Container: `Translations` (partition key: `/id`)

## URLs

- **Aplikacja główna**: https://red-stone-0f1cfc203.3.azurestaticapps.net
- **Translator App**: https://red-stone-0f1cfc203.3.azurestaticapps.net/translator.html
- **API Base**: https://red-stone-0f1cfc203.3.azurestaticapps.net/api

## GitHub Secrets (✅ Skonfigurowane)

Następujące secrets zostały dodane do repozytorium:

1. `AZURE_STATIC_WEB_APPS_API_TOKEN` - deployment token
2. `TRANSLATOR_KEY` - klucz Azure Translator Service
3. `COSMOS_ENDPOINT` - endpoint Cosmos DB
4. `COSMOS_KEY` - klucz dostępu Cosmos DB
5. `AZURE_STORAGE_CONNECTION_STRING` - connection string Storage Account

## Funkcjonalności API

### 1. Tłumaczenie tekstu
**Endpoint**: `POST /api/translateText`

Przykładowe wywołanie:
```javascript
fetch('/api/translateText', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Hello world',
    targetLanguage: 'pl',
    sourceLanguage: 'en' // opcjonalne
  })
})
```

### 2. Upload pliku
**Endpoint**: `POST /api/uploadFile`

Przykładowe wywołanie:
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

fetch('/api/uploadFile', {
  method: 'POST',
  body: formData
})
```

### 3. Lista plików
**Endpoint**: `GET /api/getFiles`

Przykładowe wywołanie:
```javascript
fetch('/api/getFiles')
  .then(res => res.json())
  .then(data => console.log(data.files))
```

### 4. Historia tłumaczeń
**Endpoint**: `GET /api/getTranslations`

Przykładowe wywołanie:
```javascript
fetch('/api/getTranslations')
  .then(res => res.json())
  .then(data => console.log(data.translations))
```

## Lokalne uruchomienie

### Wymagania:
- Node.js 18+
- Azure Functions Core Tools 4
- Azure CLI (opcjonalnie)

### Backend (Azure Functions):

1. Zainstaluj zależności:
```bash
cd api
npm install
```

2. Utwórz `api/local.settings.json`:
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AZURE_STORAGE_CONNECTION_STRING": "<your-connection-string>",
    "COSMOS_ENDPOINT": "https://translator-db-pl.documents.azure.com:443/",
    "COSMOS_KEY": "<your-cosmos-key>",
    "TRANSLATOR_KEY": "<your-translator-key>",
    "TRANSLATOR_ENDPOINT": "https://api.cognitive.microsofttranslator.com",
    "TRANSLATOR_REGION": "westeurope"
  }
}
```

3. Uruchom Functions:
```bash
npm start
```

### Frontend:

1. Użyj Live Server w VS Code lub:
```bash
npx http-server
```

2. Otwórz `translator.html` w przeglądarce

## Deployment

Każdy push do branch `main` automatycznie wdraża aplikację przez GitHub Actions.

### Workflow:
1. Code push → GitHub
2. GitHub Actions trigger
3. Build frontend
4. Build Azure Functions (TypeScript → JavaScript)
5. Deploy do Azure Static Web Apps
6. Inject environment variables
7. ✅ Aplikacja live!

## Monitorowanie

### Azure Portal:
1. Wejdź na https://portal.azure.com
2. Przejdź do Resource Group `translator-rg`
3. Sprawdź metryki i logi

### Application Insights:
- Można dodać Application Insights dla szczegółowego monitorowania
- Śledzenie requestów, błędów, performance

## Koszty (miesięczne szacunki)

| Zasób | Koszt |
|-------|-------|
| Static Web App (Free tier) | $0 |
| Azure Functions (Consumption) | ~$0-5 (zależnie od użycia) |
| Translator Service (S1) | ~$10 (2M znaków) |
| Cosmos DB (400 RU/s) | ~$24 |
| Blob Storage (100GB) | ~$2 |
| **RAZEM** | **~$36-41/miesiąc** |

### Optymalizacja kosztów:
- Użyj Cosmos DB Serverless zamiast provisioned
- Monitoruj usage i wyłącz zasoby gdy nieużywane
- Rozważ Free tier dla Translator (2M znaków/miesiąc)

## Bezpieczeństwo

### Aktualne zabezpieczenia:
- ✅ HTTPS dla wszystkich połączeń
- ✅ Secrets w GitHub Secrets (nie w kodzie)
- ✅ Azure Managed Identity (dla Functions → Storage/Cosmos)
- ✅ CORS skonfigurowany w Static Web Apps

### Rekomendacje dodatkowe:
- [ ] Dodaj Azure AD authentication
- [ ] Rate limiting na API
- [ ] Input validation i sanitization
- [ ] WAF (Web Application Firewall)
- [ ] Key Vault dla kluczy (zamiast GitHub Secrets)

## Troubleshooting

### Problem: API nie działa
**Rozwiązanie**:
1. Sprawdź logi w GitHub Actions
2. Zweryfikuj czy wszystkie secrets są dodane
3. Sprawdź logi Azure Functions w Portal

### Problem: Nie ma połączenia z Cosmos DB
**Rozwiązanie**:
1. Sprawdź czy endpoint i key są poprawne
2. Zweryfikuj czy database i containers istnieją
3. Sprawdź network rules w Cosmos DB

### Problem: Translator API zwraca błąd
**Rozwiązanie**:
1. Sprawdź czy klucz jest poprawny
2. Zweryfikuj region (westeurope)
3. Sprawdź quota w Azure Portal

## Następne kroki

### Możliwe rozszerzenia:
1. **Document Translation** - tłumaczenie całych dokumentów (PDF, DOCX)
2. **Batch Translation** - masowe tłumaczenie wielu plików
3. **Custom Translator** - własne modele tłumaczeń
4. **Speech Translation** - tłumaczenie mowy
5. **User Authentication** - logowanie użytkowników
6. **Multi-tenancy** - obsługa wielu organizacji
7. **Advanced Analytics** - dashboardy i raporty
8. **Mobile App** - aplikacja mobilna (React Native)

## Support

Dla problemów i pytań:
- Otwórz issue na GitHub: https://github.com/Orsonik/translator-app/issues
- Sprawdź dokumentację Azure: https://docs.microsoft.com/azure
