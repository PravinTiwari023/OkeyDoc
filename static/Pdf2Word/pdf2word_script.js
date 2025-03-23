// Loading Bar Animation
window.addEventListener('load', () => {
    const loadingBar = document.getElementById('loadingBar');
    loadingBar.style.width = '100%';
    
    setTimeout(() => {
        loadingBar.style.opacity = '0';
    }, 500);
});

// Back to Top Button
const backToTopBtn = document.getElementById('backToTop');

window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
        backToTopBtn.classList.add('visible');
    } else {
        backToTopBtn.classList.remove('visible');
    }
});

backToTopBtn.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// PDF to Word Conversion Functionality
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileCount = document.getElementById('fileCount');
const totalSize = document.getElementById('totalSize');
const organizeOptions = document.getElementById('organizeOptions');
const convertBtn = document.getElementById('convertBtn');
const loadingBar = document.getElementById('loadingBar');
let files = [];

// Drag and drop functionality
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('active');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('active');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('active');
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file =>
        file.type === 'application/pdf'
    );
    handleFiles(droppedFiles);
});

dropZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const selectedFiles = Array.from(e.target.files);
    handleFiles(selectedFiles);
});

function handleFiles(newFiles) {
    if (newFiles.length === 0) {
        alert('Please select valid PDF documents');
        return;
    }

    files = newFiles;
    updateFileInfo();
    showFileInfo();
}

function updateFileInfo() {
    fileName.textContent = files.length === 1 ? files[0].name : 'Multiple Documents';
    fileCount.textContent = `${files.length} document${files.length !== 1 ? 's' : ''}`;
    const totalBytes = files.reduce((acc, file) => acc + file.size, 0);
    totalSize.textContent = formatFileSize(totalBytes);
    convertBtn.disabled = files.length === 0;
    organizeOptions.style.display = files.length > 0 ? 'block' : 'none';
}

function showFileInfo() {
    fileInfo.style.display = 'block';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i + 1)).toFixed(1)} ${sizes[i]}`;
}

// Convert PDF to Word using server API
async function convertPDFToWord(pdfFile) {
    try {
        const formData = new FormData();
        formData.append('pdf', pdfFile);
        formData.append('format', document.querySelector('input[name="format"]:checked').value);

        const response = await fetch('/api/pdf-to-word', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Server error response:', errorData);
            throw new Error(errorData.error || 'Conversion failed');
        }

        const blob = await response.blob();
        return blob;
    } catch (error) {
        console.error('Error converting PDF to Word:', error);
        throw new Error(`Failed to convert document: ${error.message}`);
    }
}

// Single event listener for conversion
convertBtn.addEventListener('click', async () => {
    if (files.length === 0) return;

    try {
        convertBtn.disabled = true;
        loadingBar.style.opacity = '1';
        loadingBar.style.width = '0%';

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            loadingBar.style.width = `${((i + 1) / files.length) * 100}%`; // Progress updates after each file

            try {
                const wordBlob = await convertPDFToWord(file);
                const url = window.URL.createObjectURL(wordBlob);
                const a = document.createElement('a');
                a.href = url;
                const format = document.querySelector('input[name="format"]:checked').value;
                a.download = file.name.replace(/\.pdf$/, `.${format}`);
                a.click();
                window.URL.revokeObjectURL(url);
            } catch (error) {
                console.error(`Error converting ${file.name}:`, error);
                alert(`Failed to convert ${file.name}: ${error.message}`);
            }
        }

        loadingBar.style.width = '100%';
        setTimeout(() => {
            loadingBar.style.opacity = '0';
        }, 500);
    } catch (error) {
        console.error('Conversion error:', error);
        alert('Error converting files: ' + error.message);
    } finally {
        convertBtn.disabled = false;
    }
});