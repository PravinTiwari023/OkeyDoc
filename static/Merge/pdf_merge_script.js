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

// PDF Management
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const pdfList = document.getElementById('pdfList');
const mergeBtn = document.getElementById('mergeBtn');
let pdfFiles = [];

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
    const validFiles = Array.from(files).filter(file => 
        file.type === 'application/pdf'
    );
    pdfFiles = [...pdfFiles, ...validFiles];
    updateFileList();
    mergeBtn.disabled = pdfFiles.length < 1;
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
    initSortable();
}

function removeFile(index) {
    pdfFiles.splice(index, 1);
    updateFileList();
    mergeBtn.disabled = pdfFiles.length < 1;
}

function initSortable() {
    new Sortable(pdfList, {
        animation: 150,
        onEnd: (evt) => {
            const [movedItem] = pdfFiles.splice(evt.oldIndex, 1);
            pdfFiles.splice(evt.newIndex, 0, movedItem);
        }
    });
}

// Merge functionality (client-side for now, can be updated for server-side)
mergeBtn.addEventListener('click', async () => {
    try {
        mergeBtn.disabled = true;
        mergeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Merging...';

        const mergedPdf = await PDFLib.PDFDocument.create();
        
        for (const file of pdfFiles) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach(page => mergedPdf.addPage(page));
        }

        const pdfBytes = await mergedPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'merged-document.pdf';
        link.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        alert('Error merging PDFs: ' + error.message);
    } finally {
        mergeBtn.disabled = false;
        mergeBtn.innerHTML = 'Merge PDFs';
    }
});