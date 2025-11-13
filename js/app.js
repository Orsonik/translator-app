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

        showToast('Plik został wgrany pomyślnie');
        
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
                    <table class="files-table" role="table" aria-label="Lista przesłanych plików">
                        <thead>
                            <tr>
                                <th scope="col">Oryginalny plik</th>
                                <th scope="col">Tłumaczenia</th>
                                <th scope="col">Akcje</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.fileGroups.map(group => `
                                <tr>
                                    <td>
                                        <div class="file-info">
                                            <div class="file-name" title="${group.originalFile.displayName}">
                                                <i class="fas fa-file-alt file-icon" aria-hidden="true"></i>
                                                <span>${group.originalFile.displayName}</span>
                                                <button class="icon-btn download-btn" 
                                                    data-filename="${group.originalFile.fileName}" 
                                                    data-container="source-files" 
                                                    aria-label="Pobierz oryginalny plik ${group.originalFile.displayName}">
                                                    <i class="fas fa-download" aria-hidden="true"></i>
                                                </button>
                                            </div>
                                            <div class="file-meta">
                                                <span>
                                                    <i class="far fa-clock" aria-hidden="true"></i>
                                                    ${new Date(group.originalFile.uploadDate).toLocaleString('pl-PL', { 
                                                        year: 'numeric', 
                                                        month: 'short', 
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                                <span>
                                                    <i class="far fa-file" aria-hidden="true"></i>
                                                    ${(group.originalFile.size / 1024).toFixed(2)} KB
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        ${group.translations.length > 0 
                                            ? `<div class="language-pills" role="list" aria-label="Dostępne tłumaczenia">
                                                ${group.translations.map(trans => `
                                                    <div class="language-pill" role="listitem">
                                                        <span>${trans.language.toUpperCase()}</span>
                                                        <span class="text-white-50" style="font-size: 0.75rem;">${(trans.size / 1024).toFixed(1)} KB</span>
                                                        <button class="icon-btn download-btn" 
                                                            data-filename="${trans.fileName}" 
                                                            data-container="translated-files"
                                                            aria-label="Pobierz tłumaczenie w języku ${trans.language}"
                                                            tabindex="0">
                                                            <i class="fas fa-download" aria-hidden="true"></i>
                                                        </button>
                                                    </div>
                                                `).join('')}
                                            </div>`
                                            : '<span class="text-white-50">Brak tłumaczeń</span>'
                                        }
                                    </td>
                                    <td>
                                        <div class="action-buttons">
                                            <button class="btn btn-primary translate-btn" 
                                                data-filename="${group.originalFile.fileName}" 
                                                data-displayname="${group.originalFile.displayName}"
                                                aria-label="Przetłumacz plik ${group.originalFile.displayName}">
                                                <i class="fas fa-language" aria-hidden="true"></i>
                                                <span>Przetłumacz</span>
                                            </button>
                                            <button class="btn btn-danger delete-btn" 
                                                data-filename="${group.originalFile.fileName}" 
                                                data-displayname="${group.originalFile.displayName}"
                                                aria-label="Usuń plik ${group.originalFile.displayName}">
                                                <i class="fas fa-trash-alt" aria-hidden="true"></i>
                                                <span>Usuń</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            console.log('No files found, showing empty message');
            filesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open" aria-hidden="true"></i>
                    <p class="text-white-50 mb-0">Brak wgranych plików</p>
                    <p class="text-white-50" style="font-size: 0.9rem;">Wgraj pierwszy plik, aby rozpocząć</p>
                </div>
            `;
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

// ===== FILE LIBRARY MANAGEMENT FUNCTIONS =====

// Translate existing file from library
let currentFileToTranslate = { fileName: '', displayName: '' };

// Show language selection modal
function showLanguageModal(fileName, displayName) {
    currentFileToTranslate = { fileName, displayName };
    document.getElementById('modalFileName').textContent = displayName;
    
    // Show formatting checkbox only for DOCX/DOC files
    const fileExtension = displayName.toLowerCase().split('.').pop();
    const formattingContainer = document.getElementById('formattingCheckboxContainer');
    if (fileExtension === 'docx' || fileExtension === 'doc') {
        formattingContainer.style.display = 'block';
    } else {
        formattingContainer.style.display = 'none';
    }
    
    const modal = new bootstrap.Modal(document.getElementById('languageModal'));
    modal.show();
}

// Confirm translation from modal
async function confirmTranslation() {
    const targetLanguage = document.getElementById('modalTargetLanguage').value;
    const { fileName, displayName } = currentFileToTranslate;
    const preserveFormatting = document.getElementById('preserveFormatting').checked;
    const fileExtension = displayName.toLowerCase().split('.').pop();
    const canPreserveFormatting = (fileExtension === 'docx' || fileExtension === 'doc') && preserveFormatting;

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('languageModal'));
    modal.hide();

    try {
        console.log('Translating existing file:', fileName, 'to', targetLanguage, 'preserveFormatting:', canPreserveFormatting);

        const response = await fetch(`${API_BASE}/translateExistingFile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileName: fileName,
                targetLanguage: targetLanguage,
                preserveFormatting: canPreserveFormatting
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Translation failed');
        }

        const result = await response.json();
        console.log('Translation result:', result);

        if (result.async && result.jobId) {
            // Async translation with formatting preservation
            showToast('Tłumaczenie rozpoczęte. Może potrwać 10-30 sekund...', 'info');
            pollTranslationStatus(result.jobId, displayName);
        } else {
            // Instant text-based translation
            showToast('Plik został przetłumaczony');
            loadFiles();
        }

    } catch (error) {
        console.error('Error translating existing file:', error);
        alert('Błąd podczas tłumaczenia pliku: ' + error.message);
    }
}

// Poll translation status for async jobs
async function pollTranslationStatus(jobId, displayName, maxAttempts = 60) {
    let attempts = 0;
    let pollInterval = null;
    
    const checkStatus = async () => {
        try {
            attempts++;
            console.log(`Checking translation status (attempt ${attempts}/${maxAttempts})...`);

            const response = await fetch(`${API_BASE}/translationStatus/${jobId}`);
            
            if (!response.ok) {
                throw new Error('Failed to check status');
            }

            const status = await response.json();
            console.log('Translation status:', status);

            if (status.status === 'completed') {
                // Translation completed successfully
                if (pollInterval) clearInterval(pollInterval);
                showToast(`Tłumaczenie zakończone: ${displayName}`);
                loadFiles(); // Reload to show new translation
            } else if (status.status === 'failed') {
                // Translation failed
                if (pollInterval) clearInterval(pollInterval);
                showToast('Tłumaczenie nie powiodło się', 'error');
                alert('Błąd podczas tłumaczenia: ' + (status.error || 'Unknown error'));
            } else if (attempts >= maxAttempts) {
                // Timeout
                if (pollInterval) clearInterval(pollInterval);
                showToast('Przekroczono limit czasu tłumaczenia', 'error');
                alert('Tłumaczenie trwa zbyt długo. Sprawdź później w zakładce Historia.');
            }
            // else: still processing, continue polling

        } catch (error) {
            console.error('Error checking translation status:', error);
            if (pollInterval) clearInterval(pollInterval);
            showToast('Błąd podczas sprawdzania statusu', 'error');
        }
    };

    // Check immediately
    await checkStatus();
    
    // Then poll every 3 seconds
    pollInterval = setInterval(checkStatus, 3000);
}

// Download file from storage
async function downloadFile(fileName, container) {
    try {
        console.log('Downloading file:', fileName, 'from:', container);

        const response = await fetch(`${API_BASE}/downloadFile?fileName=${encodeURIComponent(fileName)}&container=${encodeURIComponent(container)}`);

        if (!response.ok) {
            throw new Error('Failed to download file');
        }

        const blob = await response.blob();
        
        // Extract filename from Content-Disposition or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        let downloadName = fileName;
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
            if (fileNameMatch) {
                downloadName = fileNameMatch[1];
            }
        }

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('File downloaded:', downloadName);

    } catch (error) {
        console.error('Error downloading file:', error);
        alert('Błąd podczas pobierania pliku: ' + error.message);
    }
}

// Delete file and its translations
let currentFileToDelete = { fileName: '', displayName: '' };

// Show delete confirmation modal
function deleteFile(fileName, displayName) {
    currentFileToDelete = { fileName, displayName };
    document.getElementById('deleteFileName').textContent = displayName;
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}

// Confirm deletion from modal
async function confirmDelete() {
    const { fileName, displayName } = currentFileToDelete;

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
    modal.hide();

    try {
        console.log('Deleting file:', fileName);

        const response = await fetch(`${API_BASE}/deleteFile`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileName: fileName
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Deletion failed');
        }

        const result = await response.json();
        console.log('Deletion result:', result);

        showToast('Plik został usunięty');
        
        // Reload files list
        loadFiles();

    } catch (error) {
        console.error('Error deleting file:', error);
        alert('Błąd podczas usuwania pliku: ' + error.message);
    }
}

// Legacy function - kept for compatibility
async function translateExistingFile(fileName, displayName) {
    // Redirect to new modal-based function
    showLanguageModal(fileName, displayName);
}

// Toast notification function
function showToast(message) {
    const toast = document.getElementById('successToast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease-out';
        setTimeout(() => {
            toast.style.display = 'none';
            toast.style.animation = '';
        }, 500);
    }, 3000);
}

// Event delegation for dynamically created buttons
document.addEventListener('DOMContentLoaded', function() {
    // Delegate events on filesList container
    const filesList = document.getElementById('filesList');
    
    if (filesList) {
        filesList.addEventListener('click', function(e) {
            const target = e.target.closest('button');
            if (!target) return;
            
            // Download button
            if (target.classList.contains('download-btn')) {
                const fileName = target.dataset.filename;
                const container = target.dataset.container;
                downloadFile(fileName, container);
            }
            
            // Translate button
            if (target.classList.contains('translate-btn')) {
                const fileName = target.dataset.filename;
                const displayName = target.dataset.displayname;
                showLanguageModal(fileName, displayName);
            }
            
            // Delete button
            if (target.classList.contains('delete-btn')) {
                const fileName = target.dataset.filename;
                const displayName = target.dataset.displayname;
                deleteFile(fileName, displayName);
            }
        });
    }
});
