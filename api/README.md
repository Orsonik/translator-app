# Translator API - Azure Functions

Backend API dla systemu zarządzania tłumaczeniami.

## Funkcje API

### 1. `translateText` (POST)
Tłumaczy tekst używając Azure Translator Service.

**Endpoint**: `/api/translateText`

**Body**:
```json
{
  "text": "Hello world",
  "targetLanguage": "pl",
  "sourceLanguage": "en"  // opcjonalne
}
```

### 2. `uploadFile` (POST)
Wgrywa plik do Azure Blob Storage.

**Endpoint**: `/api/uploadFile`

**Body**: multipart/form-data z plikiem

### 3. `getFiles` (GET)
Pobiera listę wgranych plików.

**Endpoint**: `/api/getFiles`

### 4. `getTranslations` (GET)
Pobiera historię tłumaczeń.

**Endpoint**: `/api/getTranslations`

## Konfiguracja

### Wymagane zmienne środowiskowe:

```
AZURE_STORAGE_CONNECTION_STRING=<connection-string>
COSMOS_ENDPOINT=<cosmos-db-endpoint>
COSMOS_KEY=<cosmos-db-key>
TRANSLATOR_KEY=<translator-key>
TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com
TRANSLATOR_REGION=westeurope
```

## Lokalne uruchomienie

1. Zainstaluj zależności:
```bash
cd api
npm install
```

2. Skonfiguruj `local.settings.json` z odpowiednimi kluczami

3. Uruchom Functions:
```bash
npm start
```

## Wdrożenie na Azure

API zostanie automatycznie wdrożone wraz z Static Web App przez GitHub Actions.

## Struktura bazy danych Cosmos DB

### Database: `TranslationsDB`

#### Container: `Files`
```json
{
  "id": "file-12345.pdf",
  "fileName": "file-12345.pdf",
  "originalName": "document.pdf",
  "uploadDate": "2025-11-08T12:00:00Z",
  "size": 102400,
  "status": "uploaded",
  "translations": []
}
```

#### Container: `Translations`
```json
{
  "id": "trans-12345",
  "originalText": "Hello",
  "translatedText": "Cześć",
  "sourceLanguage": "en",
  "targetLanguage": "pl",
  "timestamp": "2025-11-08T12:00:00Z",
  "confidence": 0.98
}
```
