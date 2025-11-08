# Translator Manager - System Zarządzania Tłumaczeniami

Aplikacja webowa do zarządzania tłumaczeniami i plikami, zbudowana na Azure Static Web Apps z wykorzystaniem Azure Translator Service.

## 🌟 Funkcjonalności

- **Tłumaczenie tekstu** - tłumaczenie tekstu między różnymi językami przy użyciu Azure Translator
- **Zarządzanie plikami** - wgrywanie i przechowywanie plików do tłumaczenia
- **Historia tłumaczeń** - przeglądanie historii wszystkich wykonanych tłumaczeń
- **Automatyczne wykrywanie języka** - opcjonalne automatyczne wykrywanie języka źródłowego
- **Responsywny interfejs** - działający na urządzeniach mobilnych i desktopowych

## 🏗️ Architektura

### Frontend
- **Azure Static Web Apps** - hosting aplikacji webowej
- **Bootstrap 5** - responsywny framework CSS
- **Vanilla JavaScript** - logika interfejsu użytkownika

### Backend
- **Azure Functions** - serverless API (Node.js + TypeScript)
- **Azure Translator Service** - tłumaczenie tekstów
- **Azure Blob Storage** - przechowywanie plików
- **Azure Cosmos DB** - baza danych NoSQL dla metadanych

## 🚀 Wdrożenie

### Wymagania
- Konto Azure
- Konto GitHub
- Azure CLI (opcjonalnie)

### Zasoby Azure

Projekt wykorzystuje następujące zasoby w Azure:
- **Resource Group**: `translator-rg` (Poland Central)
- **Static Web App**: `translator-app` (West Europe)
- **Translator Service**: `translator-service-pl` (West Europe, SKU: S1)
- **Storage Account**: `translatorstoragepl` (Poland Central)
- **Cosmos DB**: `translator-db-pl` (Poland Central)

### Deployment

Aplikacja jest automatycznie wdrażana przez GitHub Actions przy każdym pushu do gałęzi `main`.

#### Konfiguracja GitHub Secrets

Dodaj następujące secrets w GitHub:
```
AZURE_STATIC_WEB_APPS_API_TOKEN
TRANSLATOR_KEY
COSMOS_ENDPOINT
COSMOS_KEY
AZURE_STORAGE_CONNECTION_STRING
```

### Lokalne uruchomienie

#### Frontend
1. Otwórz `translator.html` w przeglądarce lub użyj live server

#### API (Azure Functions)
1. Zainstaluj zależności:
```bash
cd api
npm install
```

2. Skonfiguruj `local.settings.json` z kluczami Azure

3. Uruchom Functions:
```bash
npm start
```

## 📚 API Endpoints

### `POST /api/translateText`
Tłumaczy tekst

**Request Body:**
```json
{
  "text": "Hello world",
  "targetLanguage": "pl",
  "sourceLanguage": "en"
}
```

**Response:**
```json
{
  "translatedText": "Witaj świecie",
  "detectedLanguage": { "language": "en", "score": 1.0 },
  "translationId": "trans-123"
}
```

### `POST /api/uploadFile`
Wgrywa plik

**Request:** multipart/form-data

**Response:**
```json
{
  "message": "File uploaded successfully",
  "fileName": "document.pdf",
  "fileId": "file-123"
}
```

### `GET /api/getFiles`
Pobiera listę plików

**Response:**
```json
{
  "files": [...],
  "count": 5
}
```

### `GET /api/getTranslations`
Pobiera historię tłumaczeń

**Response:**
```json
{
  "translations": [...],
  "count": 10
}
```

## 🌐 URL Produkcyjny

**Aplikacja**: https://red-stone-0f1cfc203.3.azurestaticapps.net

- Strona główna: `/index.html`
- Aplikacja tłumaczeniowa: `/translator.html`

## 📦 Struktura Projektu

```
translator/
├── index.html                 # Strona powitalna
├── translator.html            # Aplikacja tłumaczeniowa
├── assets/                    # Zasoby statyczne
├── css/                       # Style CSS
├── js/
│   ├── scripts.js            # Skrypty Bootstrap theme
│   └── app.js                # Logika aplikacji
├── api/                       # Azure Functions API
│   ├── src/functions/
│   │   ├── translateText.ts
│   │   ├── uploadFile.ts
│   │   ├── getFiles.ts
│   │   └── getTranslations.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── host.json
├── .github/workflows/         # GitHub Actions
└── staticwebapp.config.json   # Konfiguracja SWA
```

## 🔐 Bezpieczeństwo

- Wszystkie klucze przechowywane jako GitHub Secrets
- Połączenia HTTPS
- Azure Managed Identity dla dostępu do zasobów
- Walidacja po stronie API

## 📊 Koszty

### Free Tier
- Azure Static Web Apps: Free tier (bezpłatny)

### Paid Resources
- Azure Translator: S1 tier (~$10/miesiąc za 2M znaków)
- Cosmos DB: ~$24/miesiąc (400 RU/s)
- Storage Account: ~$0.02/GB/miesiąc

**Szacowany koszt miesięczny**: ~$35-40 USD przy normalnym użytkowaniu

## 🛠️ Technologie

- **Frontend**: HTML5, CSS3, JavaScript (ES6+), Bootstrap 5
- **Backend**: Azure Functions, Node.js, TypeScript
- **Bazy danych**: Azure Cosmos DB (NoSQL)
- **Storage**: Azure Blob Storage
- **AI/ML**: Azure Translator Service (Cognitive Services)
- **Hosting**: Azure Static Web Apps
- **CI/CD**: GitHub Actions

## 📝 Licencja

Bootstrap Grayscale Theme - MIT License

## 👥 Autorzy

Projekt stworzony jako demo aplikacji Azure Static Web Apps z Azure Translator Service.

## 🤝 Contributing

Pull requesty są mile widziane! Dla większych zmian proszę najpierw otworzyć issue.

## 📞 Kontakt

Dla pytań i sugestii proszę otworzyć issue na GitHub.

