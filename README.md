# Bootstrap Grayscale Theme - Azure Static Web App

Prosta aplikacja webowa wykorzystująca theme Bootstrap Grayscale, przygotowana do wdrożenia na Azure Static Web Apps.

## Struktura projektu

```
translator/
├── index.html              # Główna strona aplikacji
├── assets/                 # Zasoby statyczne (obrazy, ikony)
│   ├── favicon.ico
│   └── img/
├── css/                    # Arkusze stylów
│   └── styles.css
├── js/                     # Pliki JavaScript
│   └── scripts.js
├── staticwebapp.config.json # Konfiguracja Azure Static Web Apps
├── .gitignore
└── README.md
```

## Wdrożenie na Azure Static Web Apps

### Metoda 1: Wdrożenie przez Azure Portal (zalecane dla początkujących)

1. **Zaloguj się do Azure Portal**: https://portal.azure.com

2. **Utwórz nowy Static Web App**:
   - Kliknij "Create a resource"
   - Wyszukaj "Static Web App"
   - Kliknij "Create"

3. **Wypełnij formularz**:
   - **Subscription**: Wybierz swoją subskrypcję
   - **Resource Group**: Utwórz nową lub wybierz istniejącą
   - **Name**: Podaj unikalną nazwę (np. `translator-app`)
   - **Region**: Wybierz najbliższy region (np. West Europe)
   - **Source**: Wybierz "GitHub" lub "Azure DevOps"
   - **GitHub account**: Zaloguj się do GitHub i autoryzuj Azure
   - **Organization**: Wybierz swoją organizację
   - **Repository**: Wybierz repozytorium z tym projektem
   - **Branch**: Wybierz gałąź (np. `main` lub `master`)

4. **Build Details**:
   - **Build Presets**: Wybierz "Custom"
   - **App location**: `/` (katalog główny)
   - **Api location**: pozostaw puste (brak API na razie)
   - **Output location**: `/` (wszystkie pliki są w katalogu głównym)

5. **Kliknij "Review + Create"**, a następnie **"Create"**

6. Po utworzeniu, Azure automatycznie:
   - Utworzy GitHub Action workflow w Twoim repozytorium
   - Zbuduje i wdroży aplikację
   - Udostępni URL aplikacji (np. `https://nice-sea-xxx.azurestaticapps.net`)

### Metoda 2: Wdrożenie przez Azure CLI

1. **Zainstaluj Azure CLI**: https://docs.microsoft.com/cli/azure/install-azure-cli

2. **Zaloguj się do Azure**:
   ```bash
   az login
   ```

3. **Utwórz Resource Group** (jeśli nie istnieje):
   ```bash
   az group create --name translator-rg --location westeurope
   ```

4. **Utwórz Static Web App**:
   ```bash
   az staticwebapp create \
     --name translator-app \
     --resource-group translator-rg \
     --source https://github.com/TWOJA-ORGANIZACJA/TWOJE-REPO \
     --location westeurope \
     --branch main \
     --app-location "/" \
     --output-location "/" \
     --login-with-github
   ```

### Metoda 3: Wdrożenie przez VS Code

1. **Zainstaluj rozszerzenie**: "Azure Static Web Apps" w VS Code

2. **Otwórz paletę poleceń** (Ctrl+Shift+P / Cmd+Shift+P)

3. **Wpisz**: "Azure Static Web Apps: Create Static Web App..."

4. **Postępuj zgodnie z instrukcjami**:
   - Wybierz subskrypcję
   - Podaj nazwę aplikacji
   - Wybierz region
   - Wybierz "Custom" jako build preset
   - App location: `/`
   - Output location: `/`

## Lokalne testowanie

Możesz przetestować aplikację lokalnie, otwierając `index.html` w przeglądarce lub używając prostego serwera HTTP:

### Python:
```bash
python -m http.server 8000
```

### Node.js (http-server):
```bash
npx http-server
```

### VS Code Live Server:
- Zainstaluj rozszerzenie "Live Server"
- Kliknij prawym przyciskiem na `index.html`
- Wybierz "Open with Live Server"

## Konfiguracja

Plik `staticwebapp.config.json` zawiera konfigurację dla Azure Static Web Apps:
- Routing i przekierowania
- Typy MIME
- Nagłówki cache
- Obsługa błędów 404

## Następne kroki

Po wdrożeniu możesz rozbudować aplikację o:
- Azure Functions (API backend)
- Uwierzytelnianie (Azure AD, GitHub, Twitter, itp.)
- Niestandardową domenę
- SSL/TLS
- CI/CD pipeline

## Linki pomocnicze

- [Dokumentacja Azure Static Web Apps](https://docs.microsoft.com/azure/static-web-apps/)
- [Bootstrap Grayscale Theme](https://startbootstrap.com/theme/grayscale/)
- [Azure Portal](https://portal.azure.com)

## Licencja

Bootstrap Grayscale Theme jest projektem open source na licencji MIT.
