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

// PDF Page Removal Functionality
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const removeBtn = document.getElementById('removeBtn');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const pageCount = document.getElementById('pageCount');
const pagePreview = document.getElementById('pagePreview');
const splitOptions = document.getElementById('splitOptions');
const pageRangeInput = document.getElementById('pageRangeInput');
const rangeInputContainer = document.getElementById('rangeInputContainer');

let pdfFile = null;
let totalPages = 0;

// File handling
const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
};

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
    dropZone.addEventListener(event, preventDefaults);
});

['dragenter', 'dragover'].forEach(event => {
    dropZone.addEventListener(event, () => {
        dropZone.classList.add('active');
    });
});

['dragleave', 'drop'].forEach(event => {
    dropZone.addEventListener(event, () => {
        dropZone.classList.remove('active');
    });
});

dropZone.addEventListener('drop', handleDrop);
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);

function handleDrop(e) {
    const dt = e.dataTransfer;
    handleFiles(dt.files);
}

function handleFileSelect(e) {
    handleFiles(e.target.files);
}

function handleFiles(files) {
    if (files.length === 0) return;
    
    const file = files[0];
    
    if (file.type !== 'application/pdf') {
        alert('Please select a valid PDF file.');
        return;
    }
    
    pdfFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    
    // Show file info and options
    fileInfo.style.display = 'block';
    splitOptions.style.display = 'block';
    removeBtn.disabled = false;
    
    // Load PDF for preview and page count
    loadPdfPreview(file);
}

async function loadPdfPreview(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const typedArray = new Uint8Array(arrayBuffer);
        
        // Use pdf.js to load the PDF and get page count
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        totalPages = pdf.numPages;
        pageCount.textContent = `${totalPages} pages`;
        
        // Generate preview placeholders
        pagePreview.innerHTML = '';
        for (let i = 1; i <= Math.min(totalPages, 6); i++) {
            const placeholder = document.createElement('div');
            placeholder.className = 'preview-placeholder';
            placeholder.innerHTML = `
                <div>Page ${i}</div>
                <div class="page-number">${i} of ${totalPages}</div>
            `;
            pagePreview.appendChild(placeholder);
        }
        
        if (totalPages > 6) {
            const ellipsis = document.createElement('div');
            ellipsis.className = 'preview-placeholder';
            ellipsis.innerHTML = `<div>...</div>`;
            pagePreview.appendChild(ellipsis);
        }
    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Error loading PDF file. Please try again.');
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function parsePageRanges(input, totalPages) {
    if (!input.trim()) return [];
    
    const pages = new Set();
    const ranges = input.split(',').map(r => r.trim());
    
    for (const range of ranges) {
        if (range.includes('-')) {
            const [start, end] = range.split('-').map(num => parseInt(num.trim()));
            
            if (isNaN(start) || isNaN(end) || start < 1 || end > totalPages || start > end) {
                throw new Error(`Invalid range: ${range}`);
            }
            
            for (let i = start; i <= end; i++) {
                pages.add(i);
            }
        } else {
            const pageNum = parseInt(range);
            
            if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
                throw new Error(`Invalid page number: ${range}`);
            }
            
            pages.add(pageNum);
        }
    }
    
    return Array.from(pages).sort((a, b) => a - b);
}

// Remove pages functionality
removeBtn.addEventListener('click', async () => {
    if (!pdfFile) return;
    
    try {
        removeBtn.disabled = true;
        removeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
        
        try {
            const pagesToRemove = parsePageRanges(pageRangeInput.value, totalPages);
            
            if (pagesToRemove.length === 0) {
                throw new Error('Please enter valid page numbers or ranges');
            }
            
            if (pagesToRemove.length === totalPages) {
                throw new Error('Cannot remove all pages from the PDF');
            }
            
            // Create a new PDF with all pages except those to be removed
            const newPdf = await PDFLib.PDFDocument.create();
            
            // Create a set of pages to keep (all pages except those to remove)
            const pagesToKeep = [];
            for (let i = 0; i < totalPages; i++) {
                if (!pagesToRemove.includes(i + 1)) { // Convert to 1-based index for comparison
                    pagesToKeep.push(i); // Keep 0-based index for copying
                }
            }
            
            // Copy the pages we want to keep
            const copiedPages = await newPdf.copyPages(pdf, pagesToKeep);
            
            copiedPages.forEach(page => {
                newPdf.addPage(page);
            });
            
            const pdfBytes = await newPdf.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `${pdfFile.name.replace('.pdf', '')}_pages_removed.pdf`;
            link.click();
            URL.revokeObjectURL(url);
            
        } catch (rangeError) {
            alert(`Error: ${rangeError.message}`);
        }
    } catch (error) {
        console.error('Error removing pages from PDF:', error);
        alert('Error processing PDF file. Please try again.');
    } finally {
        removeBtn.disabled = false;
        removeBtn.innerHTML = 'Remove Pages';
    }
});