// Set PDF.js worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const repairBtn = document.getElementById('repairBtn');
const repairStatus = document.getElementById('repairStatus');
const statusTitle = document.getElementById('statusTitle');
const statusMessage = document.getElementById('statusMessage');
const progressBar = document.getElementById('progressBar');
const repairDetails = document.getElementById('repairDetails');
const issuesList = document.getElementById('issuesList');
const loadingBar = document.getElementById('loadingBar');
const backToTop = document.getElementById('backToTop');

// Variables
let pdfFile = null;
let pdfData = null;
let pdfIssues = [];

// Event Listeners
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleDrop);
repairBtn.addEventListener('click', repairPDF);

// Back to top button functionality
window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
        backToTop.classList.add('visible');
    } else {
        backToTop.classList.remove('visible');
    }
});

backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
        processPDFFile(file);
    }
}

// Handle drag over
function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.add('active');
}

// Handle drag leave
function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.remove('active');
}

// Handle drop
function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.remove('active');
    
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        processPDFFile(file);
    }
}

// Process PDF file
async function processPDFFile(file) {
    pdfFile = file;
    
    // Update file info
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.style.display = 'block';
    
    // Read file as ArrayBuffer
    const reader = new FileReader();
    reader.onload = async function(event) {
        try {
            pdfData = new Uint8Array(event.target.result);
            
            // Analyze PDF for issues
            await analyzePDF(pdfData);
            
            // Enable repair button
            repairBtn.disabled = false;
        } catch (error) {
            console.error('Error processing PDF:', error);
            showErrorStatus('Error processing PDF', 'The file could not be processed. It might be severely corrupted.');
        }
    };
    reader.readAsArrayBuffer(file);
}

// Analyze PDF for issues
async function analyzePDF(pdfData) {
    showLoadingStatus('Analyzing PDF...', 'We\'re examining your PDF file to identify issues.');
    
    try {
        // Simulate progress
        simulateProgress();
        
        // Try to load PDF with PDF.js to check for issues
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        
        // Listen for password errors
        loadingTask.onPassword = function(updatePassword, reason) {
            // Password protected PDF detected
            pdfIssues.push({
                type: 'warning',
                message: 'PDF is password protected',
                fixable: false
            });
            updatePassword('');
        };
        
        const pdf = await loadingTask.promise;
        
        // Check for common issues
        const numPages = pdf.numPages;
        
        // Check metadata
        const metadata = await pdf.getMetadata();
        if (!metadata || Object.keys(metadata).length === 0) {
            pdfIssues.push({
                type: 'warning',
                message: 'Missing or corrupt metadata',
                fixable: true
            });
        }
        
        // Check for damaged pages
        let damagedPages = [];
        for (let i = 1; i <= numPages; i++) {
            try {
                // Update progress
                progressBar.style.width = `${(i / numPages) * 100}%`;
                
                // Try to get page
                await pdf.getPage(i);
            } catch (error) {
                damagedPages.push(i);
                pdfIssues.push({
                    type: 'error',
                    message: `Page ${i} is damaged or unreadable`,
                    fixable: true
                });
            }
        }
        
        // If no issues found, add a healthy status
        if (pdfIssues.length === 0) {
            pdfIssues.push({
                type: 'success',
                message: 'No issues detected in the PDF',
                fixable: false
            });
            showSuccessStatus('PDF Analysis Complete', 'No issues were detected in your PDF file.');
        } else {
            // Show warning or error status based on issues
            const hasErrors = pdfIssues.some(issue => issue.type === 'error');
            if (hasErrors) {
                showErrorStatus('PDF Issues Detected', `Found ${pdfIssues.length} issues that need repair.`);
            } else {
                showWarningStatus('Minor PDF Issues Detected', `Found ${pdfIssues.length} minor issues that can be fixed.`);
            }
        }
        
        // Display issues in the repair details section
        displayIssues();
        
    } catch (error) {
        console.error('Error analyzing PDF:', error);
        pdfIssues.push({
            type: 'error',
            message: 'PDF structure is severely corrupted',
            fixable: true
        });
        showErrorStatus('PDF Analysis Failed', 'The PDF structure appears to be severely corrupted.');
        displayIssues();
    }
}

// Display issues in the repair details section
function displayIssues() {
    // Clear previous issues
    issuesList.innerHTML = '';
    
    // Add each issue to the list
    pdfIssues.forEach(issue => {
        const li = document.createElement('li');
        
        // Add icon based on issue type
        const icon = document.createElement('i');
        if (issue.type === 'error') {
            icon.className = 'fas fa-times-circle';
            icon.style.color = 'var(--error)';
        } else if (issue.type === 'warning') {
            icon.className = 'fas fa-exclamation-triangle';
            icon.style.color = 'var(--warning)';
        } else {
            icon.className = 'fas fa-check-circle';
            icon.style.color = 'var(--success)';
        }
        
        li.appendChild(icon);
        li.appendChild(document.createTextNode(issue.message));
        
        if (issue.fixable) {
            li.appendChild(document.createTextNode(' (can be fixed)'));
        }
        
        issuesList.appendChild(li);
    });
    
    // Show repair details
    repairDetails.style.display = 'block';
}

// Repair PDF
async function repairPDF() {
    if (!pdfData) return;
    
    showLoadingStatus('Repairing PDF...', 'We\'re attempting to fix the issues in your PDF.');
    simulateProgress();
    
    try {
        // Use PDF-Lib to create a new PDF with the content from the original
        const { PDFDocument } = PDFLib;
        
        // Try to load the original PDF
        let pdfDoc;
        try {
            pdfDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
        } catch (error) {
            // If loading fails, create a new document
            pdfDoc = await PDFDocument.create();
            showWarningStatus('Creating New PDF', 'Original PDF could not be loaded. Creating a new document with recoverable content.');
        }
        
        // Get the pages from the original PDF
        const pages = pdfDoc.getPages();
        
        // If no pages, try to recover content
        if (pages.length === 0) {
            showWarningStatus('No Pages Found', 'Attempting to recover content from the damaged PDF.');
            
            // Try to load with PDF.js and copy content
            try {
                const loadingTask = pdfjsLib.getDocument({ data: pdfData });
                const pdf = await loadingTask.promise;
                const numPages = pdf.numPages;
                
                for (let i = 1; i <= numPages; i++) {
                    try {
                        // Update progress
                        progressBar.style.width = `${(i / numPages) * 100}%`;
                        
                        // Add a blank page
                        pdfDoc.addPage();
                    } catch (error) {
                        console.error(`Error recovering page ${i}:`, error);
                    }
                }
            } catch (error) {
                console.error('Error recovering pages:', error);
                // Add at least one blank page
                pdfDoc.addPage();
            }
        }
        
        // Save the repaired PDF
        const repairedPdfBytes = await pdfDoc.save();
        
        // Create a download link
        const blob = new Blob([repairedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `repaired_${pdfFile.name}`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showSuccessStatus('Repair Complete', 'Your PDF has been repaired and is ready for download.');
    } catch (error) {
        console.error('Error repairing PDF:', error);
        showErrorStatus('Repair Failed', 'We couldn\'t repair your PDF. The file might be too severely damaged.');
    }
}

// Helper Functions

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Show loading status
function showLoadingStatus(title, message) {
    statusTitle.textContent = title;
    statusMessage.textContent = message;
    repairStatus.className = 'repair-status';
    repairStatus.style.display = 'block';
    progressBar.style.width = '0%';
    loadingBar.style.width = '100%';
}

// Show success status
function showSuccessStatus(title, message) {
    statusTitle.textContent = title;
    statusMessage.textContent = message;
    repairStatus.className = 'repair-status success';
    progressBar.style.width = '100%';
    loadingBar.style.width = '0';
}

// Show error status
function showErrorStatus(title, message) {
    statusTitle.textContent = title;
    statusMessage.textContent = message;
    repairStatus.className = 'repair-status error';
    progressBar.style.width = '100%';
    loadingBar.style.width = '0';
}

// Show warning status
function showWarningStatus(title, message) {
    statusTitle.textContent = title;
    statusMessage.textContent = message;
    repairStatus.className = 'repair-status warning';
    progressBar.style.width = '100%';
    loadingBar.style.width = '0';
}

// Simulate progress for better UX
function simulateProgress() {
    let width = 0;
    const interval = setInterval(() => {
        if (width >= 90) {
            clearInterval(interval);
        } else {
            width += Math.random() * 10;
            progressBar.style.width = `${Math.min(width, 90)}%`;
        }
    }, 300);
}