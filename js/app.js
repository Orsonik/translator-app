// API endpoint - ustaw na URL swojego Azure Functions API
const API_BASE = '/api';  // Dla lokalnego developmentu
// const API_BASE = 'https://translator-app.azurewebsites.net/api';  // Dla production

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

        const response = await fetch(`${API_BASE}/uploadFile`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Błąd wgrywania pliku');
        }

        const data = await response.json();
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
    try {
        const response = await fetch(`${API_BASE}/getFiles`);
        
        if (!response.ok) {
            throw new Error('Błąd ładowania plików');
        }

        const data = await response.json();
        const filesList = document.getElementById('filesList');

        if (data.files && data.files.length > 0) {
            filesList.innerHTML = data.files.map(file => `
                <div class="file-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h5 class="text-white mb-1">
                                <i class="fas fa-file"></i> ${file.fileName}
                            </h5>
                            <p class="text-white-50 mb-0">
                                <small>Wgrano: ${new Date(file.uploadDate).toLocaleString('pl-PL')}</small>
                                <small class="ms-3">Rozmiar: ${(file.size / 1024).toFixed(2)} KB</small>
                            </p>
                        </div>
                        <span class="badge bg-success">${file.status}</span>
                    </div>
                </div>
            `).join('');
        } else {
            filesList.innerHTML = '<p class="text-white-50 text-center">Brak wgranych plików</p>';
        }

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('filesList').innerHTML = 
            '<p class="text-white-50 text-center">Nie można załadować listy plików. Sprawdź czy API jest uruchomione.</p>';
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
            historyList.innerHTML = data.translations.map(trans => `
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
            `).join('');
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
