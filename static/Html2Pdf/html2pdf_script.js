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

// HTML to PDF Conversion Functionality
const urlInput = document.getElementById('urlInput');
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

// URL validation function
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

// Convert URL to PDF
async function convertURLToPDF(url) {
    try {
        const quality = document.querySelector('input[name="quality"]:checked')?.value || 'high';
        
        // Show loading state
        loadingBar.style.opacity = '1';
        loadingBar.style.width = '50%';
        
        // Make API request to backend for conversion
        const response = await fetch('/api/html2pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: url,
                quality: quality
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Conversion failed');
        }
        
        // Get the PDF blob
        const pdfBlob = await response.blob();
        
        // Create download link
        const downloadUrl = window.URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'converted.pdf';
        a.click();
        
        // Cleanup
        window.URL.revokeObjectURL(downloadUrl);
        
        // Complete loading animation
        loadingBar.style.width = '100%';
        setTimeout(() => {
            loadingBar.style.opacity = '0';
        }, 500);
        
    } catch (error) {
        console.error('Error converting URL to PDF:', error);
        alert('Failed to convert website to PDF: ' + error.message);
        loadingBar.style.opacity = '0';
    }
}

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
        file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm')
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
        alert('Please select valid HTML files (HTML or HTM files)');
        return;
    }

    files = newFiles;
    updateFileInfo();
    showFileInfo();
}

function updateFileInfo() {
    fileName.textContent = files.length === 1 ? files[0].name : 'Multiple Files';
    fileCount.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;
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

// Convert HTML to PDF using html2pdf.js library
async function convertHTMLToPDF(htmlFile) {
    try {
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onload = async (e) => {
                try {
                    const htmlContent = e.target.result;

                    // Create a hidden container and append it to the DOM for proper rendering
                    const container = document.createElement('div');
                    container.style.position = 'absolute';
                    container.style.left = '-9999px'; // Off-screen to avoid visibility
                    container.style.top = '-9999px';
                    container.innerHTML = htmlContent;
                    document.body.appendChild(container);

                    // Wait briefly for rendering (optional, adjust as needed)
                    await new Promise(resolve => setTimeout(resolve, 100));

                    const quality = document.querySelector('input[name="quality"]:checked')?.value || 'high';
                    const opt = {
                        margin: 10,
                        filename: htmlFile.name.replace(/\.html?$/, '.pdf'),
                        image: { type: 'jpeg', quality: quality === 'high' ? 0.98 : quality === 'medium' ? 0.8 : 0.6 },
                        html2canvas: { scale: quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1 },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                    };

                    // Generate PDF
                    const pdf = await html2pdf().from(container).set(opt).output('blob');

                    // Clean up
                    document.body.removeChild(container);

                    resolve(pdf);
                } catch (error) {
                    console.error('HTML2PDF conversion error:', error);
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(htmlFile);
        });
    } catch (error) {
        console.error('Error converting HTML to PDF:', error);
        throw new Error(`Failed to convert document: ${error.message}`);
    }
}

// Combined convert button click handler
convertBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    
    if (url) {
        // Handle URL conversion
        if (!isValidUrl(url)) {
            alert('Please enter a valid URL');
            return;
        }
        await convertURLToPDF(url);
    } else if (files.length > 0) {
        // Handle file conversion
        try {
            convertBtn.disabled = true;
            loadingBar.style.opacity = '1';
            loadingBar.style.width = '0%';

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                loadingBar.style.width = `${((i + 1) / files.length) * 100}%`;

                try {
                    const pdfBlob = await convertHTMLToPDF(file);
                    const url = window.URL.createObjectURL(pdfBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = file.name.replace(/\.html?$/, '.pdf');
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
    } else {
        alert('Please enter a URL or select HTML files to convert');
    }
});