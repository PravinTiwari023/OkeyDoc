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

// PDF to Excel Conversion Functionality
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
        file.name.toLowerCase().endsWith('.pdf')
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
        alert('Please select valid PDF files');
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

// Convert PDF to Excel using server API
async function convertPDFToExcel(pdfFile) {
    try {
        const formData = new FormData();
        formData.append('pdf', pdfFile);
        formData.append('quality', document.querySelector('input[name="quality"]:checked').value);

        const response = await fetch('/api/pdf-to-excel', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Conversion failed');
        }

        const blob = await response.blob();
        return blob;
    } catch (error) {
        console.error('Error converting PDF to Excel:', error);
        throw new Error(`Failed to convert document: ${error.message}`);
    }
}

convertBtn.addEventListener('click', async () => {
    if (files.length === 0) return;

    try {
        convertBtn.disabled = true;
        loadingBar.style.opacity = '1';
        loadingBar.style.width = '0%';

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            loadingBar.style.width = `${(i / files.length) * 100}%`;

            try {
                const excelBlob = await convertPDFToExcel(file);
                const url = window.URL.createObjectURL(excelBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name.replace(/\.pdf$/, '.xlsx');
                a.click();
                window.URL.revokeObjectURL(url);
            } catch (error) {
                console.error(`Error converting ${file.name}:`, error);
                alert(`Failed to convert ${file.name}. Please try again.`);
            }
        }

        loadingBar.style.width = '100%';
        setTimeout(() => {
            loadingBar.style.opacity = '0';
        }, 500);
    } catch (error) {
        console.error('Conversion error:', error);
        alert('Error converting files. Please try again.');
    } finally {
        convertBtn.disabled = false;
    }
});