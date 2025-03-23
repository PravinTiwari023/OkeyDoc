// Loading Bar Animation
window.addEventListener('load', () => {
    const loadingBar = document.getElementById('loadingBar');
    loadingBar.style.width = '100%';
    setTimeout(() => loadingBar.style.opacity = '0', 500);
});



// Back to Top
const backToTopBtn = document.getElementById('backToTop');
window.addEventListener('scroll', () => {
    backToTopBtn.classList.toggle('visible', window.pageYOffset > 300);
});
backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// PDF Compression Logic with Flask Server Integration
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const pdfList = document.getElementById('pdfList');
const compressBtn = document.getElementById('compressBtn');
const compressionLevel = document.getElementById('compressionLevel');
const resultsDiv = document.getElementById('results');
const resultsContent = document.getElementById('resultsContent');
let pdfFiles = [];

// Drag and Drop Handling
const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
};

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
    dropZone.addEventListener(event, preventDefaults);
});

['dragenter', 'dragover'].forEach(event => {
    dropZone.addEventListener(event, () => dropZone.classList.add('active'));
});

['dragleave', 'drop'].forEach(event => {
    dropZone.addEventListener(event, () => dropZone.classList.remove('active'));
});

dropZone.addEventListener('drop', handleDrop);
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);

function handleDrop(e) {
    handleFiles(e.dataTransfer.files);
}

function handleFileSelect(e) {
    handleFiles(e.target.files);
}

function handleFiles(files) {
    const validFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    pdfFiles = [...pdfFiles, ...validFiles];
    updateFileList();
    compressBtn.disabled = pdfFiles.length < 1;
    resultsDiv.style.display = 'none'; // Hide results when new files are added
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function updateFileList() {
    pdfList.innerHTML = '';
    pdfFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'pdf-item';
        item.innerHTML = `
            <i class="fas fa-file-pdf"></i>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <button class="remove-btn" onclick="removeFile(${index})" aria-label="Remove file">
                <i class="fas fa-trash"></i>
            </button>
        `;
        pdfList.appendChild(item);
    });
}

function removeFile(index) {
    pdfFiles.splice(index, 1);
    updateFileList();
    compressBtn.disabled = pdfFiles.length < 1;
    if (pdfFiles.length === 0) resultsDiv.style.display = 'none';
}

// Improved Compression Function with Better Error Handling
compressBtn.addEventListener('click', async () => {
    try {
        if (pdfFiles.length === 0) {
            alert('Please select at least one PDF file to compress.');
            return;
        }

        compressBtn.disabled = true;
        compressBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Compressing...';
        resultsContent.innerHTML = '';
        resultsDiv.style.display = 'none';

        const level = compressionLevel.value;
        const results = [];

        // Process each file one at a time to prevent server overload
        for (const file of pdfFiles) {
            const originalSize = file.size;
            const formData = new FormData();
            formData.append('pdf', file);
            formData.append('level', level);

            console.log('Sending request to compress:', file.name, level);

            try {
                // Get current origin for relative URL
                const origin = window.location.origin;
                const url = `${origin}/compress`;
                
                const response = await fetch(url, {
                    method: 'POST',
                    body: formData
                });

                console.log('Server response status:', response.status);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Server error: ${response.status} - ${errorText || 'Failed to compress'}`);
                }

                const blob = await response.blob();
                const compressedSize = blob.size;
                const sizeReduction = originalSize - compressedSize;
                const reductionPercentage = ((sizeReduction / originalSize) * 100).toFixed(1);

                const downloadUrl = URL.createObjectURL(blob);

                results.push({
                    name: file.name,
                    originalSize: formatFileSize(originalSize),
                    compressedSize: formatFileSize(compressedSize),
                    reduction: formatFileSize(sizeReduction),
                    percentage: reductionPercentage,
                    downloadUrl: downloadUrl
                });
            } catch (fileError) {
                console.error('Error processing file:', file.name, fileError);
                results.push({
                    name: file.name,
                    error: true,
                    errorMessage: fileError.message || 'Failed to process file'
                });
            }
        }

        // Display results
        resultsDiv.style.display = 'block';
        
        // First show successful compressions
        const successfulResults = results.filter(result => !result.error);
        successfulResults.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            resultItem.innerHTML = `
                <div class="result-filename">${result.name}</div>
                <div class="result-stats">
                    <div class="result-stat">
                        <div class="stat-label">Original Size</div>
                        <div class="stat-value">${result.originalSize}</div>
                    </div>
                    <div class="result-stat">
                        <div class="stat-label">Compressed Size</div>
                        <div class="stat-value">${result.compressedSize}</div>
                    </div>
                    <div class="result-stat">
                        <div class="stat-label">Size Reduction</div>
                        <div class="stat-value">${result.reduction}</div>
                    </div>
                    <div class="result-stat">
                        <div class="stat-label">Reduction</div>
                        <div class="stat-value reduction-percentage">${result.percentage}%</div>
                    </div>
                </div>
                <a href="${result.downloadUrl}" download="compressed-${result.name}" class="result-download">
                    <i class="fas fa-download"></i> Download Compressed PDF
                </a>
            `;
            resultsContent.appendChild(resultItem);
        });
        
        // Then show errors if any
        const failedResults = results.filter(result => result.error);
        failedResults.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item error-item';
            resultItem.innerHTML = `
                <div class="result-filename">${result.name}</div>
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    Error: ${result.errorMessage}
                </div>
            `;
            resultsContent.appendChild(resultItem);
        });

        pdfFiles = [];
        updateFileList();
    } catch (error) {
        alert('Error compressing PDFs: ' + error.message);
        console.error('Compression error:', error);
    } finally {
        compressBtn.disabled = false;
        compressBtn.innerHTML = 'Compress PDFs';
    }
});