// API endpoint - ustaw na URL swojego Azure Functions API
const API_BASE = '/api';  // Dla lokalnego developmentu
// const API_BASE = 'https://translator-app.azurewebsites.net/api';  // Dla production

let translatedFileBlob = null; // Store translated file

// Translate text function
async function translateText() {
    const sourceText = document.getElementById('sourceText').value;
    const sourceLang = document.getElementById('sourceLanguage').value;
    const targetLang = document.getElementById('targetLanguage').value;

    if (!sourceText.trim()) {
        alert('Proszę wprowadzić tekst do tłumaczenia');
        return;
    }

    const loading = document.getElementById('translationLoading');
    loading.style.display = 'block';

    try {
        const response = await fetch(`${API_BASE}/translateText`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: sourceText,
                targetLanguage: targetLang,
                sourceLanguage: sourceLang || undefined
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('API Error:', errorData);
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Translation response:', data);
        document.getElementById('translatedText').value = data.translatedText;

        if (data.detectedLanguage) {
            console.log('Wykryty język:', data.detectedLanguage);
        }

        // Refresh history
        loadHistory();

    } catch (error) {
        console.error('Translation error details:', error);
        alert(`Wystąpił błąd podczas tłumaczenia: ${error.message}\n\nSprawdź konsolę przeglądarki (F12) aby zobaczyć szczegóły.`);
    } finally {
        loading.style.display = 'none';
    }
}

// Select file function - opens file dialog
function selectFile() {
    const fileInput = document.getElementById('fileInput');
    fileInput.click();
}

// Handle file selection
document.getElementById('fileInput')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        // Show selected file info
        document.getElementById('selectedFileName').textContent = file.name;
        document.getElementById('selectedFileSize').textContent = `(${(file.size / 1024).toFixed(2)} KB)`;
        document.getElementById('selectedFileInfo').style.display = 'block';
        document.getElementById('uploadButton').style.display = 'inline-block';
    } else {
        // Hide if no file selected
        document.getElementById('selectedFileInfo').style.display = 'none';
        document.getElementById('uploadButton').style.display = 'none';
    }
});

// Upload file function
async function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('Proszę najpierw wybrać plik');
        return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        alert('Plik jest za duży. Maksymalny rozmiar to 10MB.');
        return;
    }

    const loading = document.getElementById('uploadLoading');
    loading.style.display = 'block';

    try {
        const formData = new FormData();
        formData.append('file', file);

        console.log('Uploading file:', file.name, 'Size:', file.size);

        const response = await fetch(`${API_BASE}/uploadFile`, {
            method: 'POST',
            body: formData
        });

        console.log('Upload response status:', response.status);
        
        const data = await response.json();
        console.log('Upload response data:', data);

        if (!response.ok || data.error) {
            throw new Error(data.error || data.message || 'Błąd wgrywania pliku');
        }

        alert(`Plik wgrany pomyślnie: ${data.fileName}`);
        
        // Clear input and UI
        fileInput.value = '';
        document.getElementById('selectedFileInfo').style.display = 'none';
        document.getElementById('uploadButton').style.display = 'none';
        
        // Refresh files list
        loadFiles();

    } catch (error) {
        console.error('Error:', error);
        alert('Wystąpił błąd podczas wgrywania pliku. Sprawdź czy API jest uruchomione.');
    } finally {
        loading.style.display = 'none';
    }
}

// Load files list
async function loadFiles() {
    console.log('Loading files list...');
    try {
        const response = await fetch(`${API_BASE}/getFiles`);
        
        console.log('getFiles response status:', response.status);
        
        if (!response.ok) {
            throw new Error('Błąd ładowania plików');
        }

        const data = await response.json();
        console.log('Files data received:', data);
        const filesList = document.getElementById('filesList');

        if (data.fileGroups && data.fileGroups.length > 0) {
            console.log(`Displaying ${data.fileGroups.length} file groups`);
            filesList.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-dark table-hover">
                        <thead>
                            <tr>
                                <th style="width: 45%">Oryginalny plik</th>
                                <th style="width: 45%">Tłumaczenia</th>
                                <th style="width: 10%">Akcje</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.fileGroups.map(group => `
                                <tr>
                                    <td>
                                        <div>
                                            <i class="fas fa-file text-primary"></i> 
                                            <strong>${group.originalFile.displayName}</strong>
                                        </div>
                                        <small class="text-white-50">
                                            ${new Date(group.originalFile.uploadDate).toLocaleString('pl-PL')} | 
                                            ${(group.originalFile.size / 1024).toFixed(2)} KB
                                        </small>
                                    </td>
                                    <td>
                                        ${group.translations.length > 0 
                                            ? group.translations.map(trans => `
                                                <div class="mb-1">
                                                    <span class="badge bg-info me-2">${trans.language.toUpperCase()}</span>
                                                    <small class="text-white-50">${trans.fileName}</small>
                                                    <small class="text-white-50 ms-2">${(trans.size / 1024).toFixed(2)} KB</small>
                                                </div>
                                            `).join('')
                                            : '<small class="text-white-50">Brak tłumaczeń</small>'
                                        }
                                    </td>
                                    <td>
                                        <button class="btn btn-sm btn-success" onclick="translateExistingFile('${group.originalFile.fileName}', '${group.originalFile.displayName}')" title="Przetłumacz plik">
                                            <i class="fas fa-language"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            console.log('No files found, showing empty message');
            filesList.innerHTML = '<p class="text-white-50 text-center">Brak wgranych plików</p>';
        }

    } catch (error) {
        console.error('Error loading files:', error);
        document.getElementById('filesList').innerHTML = 
            '<p class="text-danger text-center">Nie można załadować listy plików. Sprawdź konsolę (F12) aby zobaczyć szczegóły.</p>';
    }
}

// Load translation history
async function loadHistory() {
    try {
        const response = await fetch(`${API_BASE}/getTranslations`);
        
        if (!response.ok) {
            throw new Error('Błąd ładowania historii');
        }

        const data = await response.json();
        const historyList = document.getElementById('historyList');

        if (data.translations && data.translations.length > 0) {
            historyList.innerHTML = data.translations.map(trans => {
                // Check if it's a file translation or text translation
                if (trans.type === 'file') {
                    return `
                        <div class="history-item">
                            <div class="d-flex justify-content-between align-items-start">
                                <div class="flex-grow-1">
                                    <h5 class="text-white mb-2">
                                        <i class="fas fa-file-alt text-info"></i> Tłumaczenie pliku
                                    </h5>
                                    <p class="text-white-50 mb-1">
                                        <strong>Oryginalny plik:</strong> ${trans.originalFileName}
                                    </p>
                                    <p class="text-white-50 mb-1">
                                        <strong>Przetłumaczony plik:</strong> ${trans.translatedFileName}
                                    </p>
                                    <p class="text-white-50 mb-1">
                                        <small>Język: ${trans.targetLanguage} | Rozmiar: ${(trans.originalSize / 1024).toFixed(2)} KB → ${(trans.translatedSize / 1024).toFixed(2)} KB</small>
                                    </p>
                                </div>
                                <span class="badge bg-info">Plik</span>
                            </div>
                            <div class="text-white-50 small mt-2">
                                <i class="far fa-clock"></i> ${new Date(trans.timestamp).toLocaleString('pl-PL')}
                            </div>
                        </div>
                    `;
                } else {
                    // Text translation
                    return `
                        <div class="history-item">
                            <div class="row">
                                <div class="col-md-5">
                                    <label class="text-white-50 small">Oryginalny tekst (${trans.sourceLanguage || 'auto'})</label>
                                    <p class="text-white">${trans.originalText}</p>
                                </div>
                                <div class="col-md-2 text-center">
                                    <i class="fas fa-arrow-right text-white-50" style="font-size: 24px; margin-top: 30px;"></i>
                                </div>
                                <div class="col-md-5">
                                    <label class="text-white-50 small">Tłumaczenie (${trans.targetLanguage})</label>
                                    <p class="text-white">${trans.translatedText}</p>
                                </div>
                            </div>
                            <div class="text-white-50 small mt-2">
                                <i class="far fa-clock"></i> ${new Date(trans.timestamp).toLocaleString('pl-PL')}
                                ${trans.confidence ? `<span class="ms-3"><i class="fas fa-check-circle"></i> Pewność: ${(trans.confidence * 100).toFixed(1)}%</span>` : ''}
                            </div>
                        </div>
                    `;
                }
            }).join('');
        } else {
            historyList.innerHTML = '<p class="text-white-50 text-center">Brak historii tłumaczeń</p>';
        }

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('historyList').innerHTML = 
            '<p class="text-white-50 text-center">Nie można załadować historii. Sprawdź czy API jest uruchomione.</p>';
    }
}

// Load data on page load
document.addEventListener('DOMContentLoaded', function() {
    loadFiles();
    loadHistory();
});

// Enable Enter key for translation
document.getElementById('sourceText')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && e.ctrlKey) {
        translateText();
    }
});

// ===== FILE TRANSLATION FUNCTIONS =====

// Select file for translation
function selectTranslateFile() {
    document.getElementById('translateFileInput').click();
}

// Handle file selection for translation
document.getElementById('translateFileInput')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert('Plik jest za duży. Maksymalny rozmiar to 10MB.');
            return;
        }

        // Show file info
        document.getElementById('translateFileName').textContent = file.name;
        document.getElementById('translateFileSize').textContent = `(${(file.size / 1024).toFixed(2)} KB)`;
        document.getElementById('translateFileInfo').style.display = 'block';
        document.getElementById('fileLanguageSelector').style.display = 'flex';
        document.getElementById('translateFileButton').style.display = 'inline-block';
        document.getElementById('translateFileResult').style.display = 'none';
    }
});

// Translate file function
async function translateFile() {
    const fileInput = document.getElementById('translateFileInput');
    const targetLang = document.getElementById('fileTargetLanguage').value;
    
    if (!fileInput.files[0]) {
        alert('Proszę wybrać plik');
        return;
    }

    const file = fileInput.files[0];
    const loading = document.getElementById('translateFileLoading');
    loading.style.display = 'block';

    console.log('Translating file:', file.name, 'Size:', file.size, 'Target language:', targetLang);

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('targetLanguage', targetLang);

        console.log('Sending file translation request...');

        const response = await fetch(`${API_BASE}/translateFile`, {
            method: 'POST',
            body: formData
        });

        console.log('File translation response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Translation failed');
        }

        // Get the translated file as blob
        translatedFileBlob = await response.blob();
        
        // Extract filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        let fileName = 'translated_' + file.name;
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
            if (fileNameMatch) {
                fileName = fileNameMatch[1];
            }
        }

        console.log('File translated successfully:', fileName);

        // Show result
        document.getElementById('translatedFileName').textContent = fileName;
        document.getElementById('translateFileResult').style.display = 'block';

    } catch (error) {
        console.error('Error:', error);
        alert('Błąd podczas tłumaczenia pliku: ' + error.message);
    } finally {
        loading.style.display = 'none';
    }
}

// Download translated file
function downloadTranslatedFile() {
    if (!translatedFileBlob) {
        alert('Brak przetłumaczonego pliku do pobrania');
        return;
    }

    const fileName = document.getElementById('translatedFileName').textContent;
    const url = window.URL.createObjectURL(translatedFileBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    console.log('File downloaded:', fileName);
}

// Translate existing file from library
async function translateExistingFile(fileName, displayName) {
    // Prompt user for target language
    const languages = [
        { code: 'en', name: 'Angielski' },
        { code: 'pl', name: 'Polski' },
        { code: 'de', name: 'Niemiecki' },
        { code: 'fr', name: 'Francuski' },
        { code: 'es', name: 'Hiszpański' },
        { code: 'it', name: 'Włoski' },
        { code: 'ru', name: 'Rosyjski' },
        { code: 'uk', name: 'Ukraiński' },
        { code: 'cs', name: 'Czeski' }
    ];

    const languageOptions = languages.map(lang => `${lang.code}: ${lang.name}`).join('\n');
    const targetLanguage = prompt(`Wybierz język docelowy dla pliku:\n${displayName}\n\nDostępne języki:\n${languageOptions}\n\nWpisz kod języka (np. en, pl, de):`);

    if (!targetLanguage) {
        return; // User cancelled
    }

    // Validate language code
    if (!languages.find(lang => lang.code === targetLanguage.toLowerCase())) {
        alert('Nieprawidłowy kod języka. Użyj jednego z: ' + languages.map(l => l.code).join(', '));
        return;
    }

    try {
        console.log('Translating existing file:', fileName, 'to', targetLanguage);

        const response = await fetch(`${API_BASE}/translateExistingFile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileName: fileName,
                targetLanguage: targetLanguage.toLowerCase()
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Translation failed');
        }

        const result = await response.json();
        console.log('Translation result:', result);

        alert(`Plik został przetłumaczony!\nJęzyk: ${result.language}\nPlik: ${result.translatedFileName}`);
        
        // Reload files list to show new translation
        loadFiles();

    } catch (error) {
        console.error('Error translating existing file:', error);
        alert('Błąd podczas tłumaczenia pliku: ' + error.message);
    }
}
