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

// PDF Organization Functionality
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const pageCount = document.getElementById('pageCount');
const pagePreview = document.getElementById('pagePreview');
const organizeOptions = document.getElementById('organizeOptions');
const pagesContainer = document.getElementById('pagesContainer');
const saveBtn = document.getElementById('saveBtn');

// Tool buttons
const rotateLeftBtn = document.getElementById('rotateLeftBtn');
const rotateRightBtn = document.getElementById('rotateRightBtn');
const moveUpBtn = document.getElementById('moveUpBtn');
const moveDownBtn = document.getElementById('moveDownBtn');
const deletePageBtn = document.getElementById('deletePageBtn');

let pdfFile = null;
let pdfDoc = null;
let totalPages = 0;
let pageRotations = {};
let pageOrder = [];
let selectedPage = null;

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
    organizeOptions.style.display = 'block';
    saveBtn.disabled = false;
    
    // Load PDF for preview and page count
    loadPdfPreview(file);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function loadPdfPreview(file) {
    try {
        // Show loading indicator
        const loadingBar = document.getElementById('loadingBar');
        loadingBar.style.opacity = '1';
        loadingBar.style.width = '0';
        
        // Load the PDF file
        const arrayBuffer = await file.arrayBuffer();
        const typedArray = new Uint8Array(arrayBuffer);
        
        // Load PDF.js
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        
        // Load the PDF document
        pdfDoc = await pdfjsLib.getDocument(typedArray).promise;
        totalPages = pdfDoc.numPages;
        pageCount.textContent = `${totalPages} pages`;
        
        // Initialize page order and rotations
        pageOrder = Array.from({ length: totalPages }, (_, i) => i + 1);
        pageRotations = {};
        for (let i = 1; i <= totalPages; i++) {
            pageRotations[i] = 0;
        }
        
        // Clear previous thumbnails
        pagesContainer.innerHTML = '';
        
        // Generate thumbnails for each page
        for (let i = 1; i <= totalPages; i++) {
            await generateThumbnail(i);
            
            // Update loading bar
            loadingBar.style.width = `${(i / totalPages) * 100}%`;
        }
        
        // Enable tool buttons
        enableToolButtons();
        
        // Hide loading indicator
        setTimeout(() => {
            loadingBar.style.opacity = '0';
        }, 500);
    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Error loading PDF. Please try again with a different file.');
    }
}

async function generateThumbnail(pageNumber) {
    try {
        // Get the page
        const page = await pdfDoc.getPage(pageNumber);
        
        // Create a canvas for the thumbnail
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // Set the scale for the thumbnail
        const viewport = page.getViewport({ scale: 0.3, rotation: pageRotations[pageNumber] });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // Render the page on the canvas
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        // Create the thumbnail container
        const thumbnailDiv = document.createElement('div');
        thumbnailDiv.className = 'page-thumbnail';
        thumbnailDiv.dataset.page = pageNumber;
        
        // Add the canvas to the thumbnail
        thumbnailDiv.appendChild(canvas);
        
        // Add page number
        const pageNumberDiv = document.createElement('div');
        pageNumberDiv.className = 'page-number';
        pageNumberDiv.textContent = `Page ${pageNumber}`;
        thumbnailDiv.appendChild(pageNumberDiv);
        
        // Add rotation indicator if rotated
        if (pageRotations[pageNumber] !== 0) {
            const rotationDiv = document.createElement('div');
            rotationDiv.className = 'page-rotation';
            rotationDiv.textContent = `${pageRotations[pageNumber]}°`;
            thumbnailDiv.appendChild(rotationDiv);
        }
        
        // Add thumbnail action buttons (rotate and delete)
        const thumbnailActions = document.createElement('div');
        thumbnailActions.className = 'thumbnail-actions';
        
        // Create rotate button
        const rotateBtn = document.createElement('button');
        rotateBtn.className = 'thumbnail-btn rotate-btn';
        rotateBtn.innerHTML = '<i class="fas fa-redo"></i>';
        rotateBtn.title = 'Rotate page';
        rotateBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the thumbnail click event
            selectedPage = pageNumber;
            rotatePage(90);
        });
        
        // Create delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'thumbnail-btn delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.title = 'Delete page';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the thumbnail click event
            selectedPage = pageNumber;
            deletePage();
        });
        
        // Add buttons to the actions container
        thumbnailActions.appendChild(rotateBtn);
        thumbnailActions.appendChild(deleteBtn);
        
        // Add actions to the thumbnail
        thumbnailDiv.appendChild(thumbnailActions);
        
        // Add click event to select the page
        thumbnailDiv.addEventListener('click', () => {
            // Deselect previously selected page
            const previouslySelected = document.querySelector('.page-thumbnail.selected');
            if (previouslySelected) {
                previouslySelected.classList.remove('selected');
            }
            
            // Select this page
            thumbnailDiv.classList.add('selected');
            selectedPage = pageNumber;
            
            // Enable/disable move buttons based on position
            updateMoveButtons();
        });
        
        // Add the thumbnail to the container
        pagesContainer.appendChild(thumbnailDiv);
    } catch (error) {
        console.error(`Error generating thumbnail for page ${pageNumber}:`, error);
    }
}

function updateMoveButtons() {
    if (!selectedPage) {
        moveUpBtn.disabled = true;
        moveDownBtn.disabled = true;
        return;
    }
    
    const index = pageOrder.indexOf(selectedPage);
    moveUpBtn.disabled = index <= 0;
    moveDownBtn.disabled = index >= pageOrder.length - 1;
}

function enableToolButtons() {
    rotateLeftBtn.disabled = false;
    rotateRightBtn.disabled = false;
    deletePageBtn.disabled = false;
    
    // Add event listeners to buttons
    rotateLeftBtn.addEventListener('click', () => rotatePage(-90));
    rotateRightBtn.addEventListener('click', () => rotatePage(90));
    moveUpBtn.addEventListener('click', movePageUp);
    moveDownBtn.addEventListener('click', movePageDown);
    deletePageBtn.addEventListener('click', deletePage);
    saveBtn.addEventListener('click', saveChanges);
    
    // Initially disable move buttons until a page is selected
    moveUpBtn.disabled = true;
    moveDownBtn.disabled = true;
}

async function rotatePage(degrees) {
    if (!selectedPage) {
        alert('Please select a page to rotate.');
        return;
    }
    
    // Update rotation for the selected page
    pageRotations[selectedPage] = (pageRotations[selectedPage] + degrees) % 360;
    if (pageRotations[selectedPage] < 0) {
        pageRotations[selectedPage] += 360;
    }
    
    // Regenerate the thumbnail
    const thumbnailDiv = document.querySelector(`.page-thumbnail[data-page="${selectedPage}"]`);
    if (thumbnailDiv) {
        pagesContainer.removeChild(thumbnailDiv);
        await generateThumbnail(selectedPage);
        
        // Re-select the page
        const newThumbnail = document.querySelector(`.page-thumbnail[data-page="${selectedPage}"]`);
        if (newThumbnail) {
            newThumbnail.classList.add('selected');
        }
    }
}

function movePageUp() {
    if (!selectedPage) return;
    
    const index = pageOrder.indexOf(selectedPage);
    if (index <= 0) return;
    
    // Swap with the previous page
    [pageOrder[index], pageOrder[index - 1]] = [pageOrder[index - 1], pageOrder[index]];
    
    // Reorder thumbnails in the DOM
    reorderThumbnails();
    
    // Update move buttons
    updateMoveButtons();
}

function movePageDown() {
    if (!selectedPage) return;
    
    const index = pageOrder.indexOf(selectedPage);
    if (index >= pageOrder.length - 1) return;
    
    // Swap with the next page
    [pageOrder[index], pageOrder[index + 1]] = [pageOrder[index + 1], pageOrder[index]];
    
    // Reorder thumbnails in the DOM
    reorderThumbnails();
    
    // Update move buttons
    updateMoveButtons();
}

function reorderThumbnails() {
    // Clear the container
    pagesContainer.innerHTML = '';
    
    // Add thumbnails in the new order
    pageOrder.forEach(async (pageNum) => {
        await generateThumbnail(pageNum);
        
        // Re-select the selected page
        if (pageNum === selectedPage) {
            const newThumbnail = document.querySelector(`.page-thumbnail[data-page="${pageNum}"]`);
            if (newThumbnail) {
                newThumbnail.classList.add('selected');
            }
        }
    });
}

function deletePage() {
    if (!selectedPage) {
        alert('Please select a page to delete.');
        return;
    }
    
    if (totalPages <= 1) {
        alert('Cannot delete the only page in the document.');
        return;
    }
    
    // Remove the page from the order
    const index = pageOrder.indexOf(selectedPage);
    pageOrder.splice(index, 1);
    
    // Remove the thumbnail
    const thumbnailDiv = document.querySelector(`.page-thumbnail[data-page="${selectedPage}"]`);
    if (thumbnailDiv) {
        pagesContainer.removeChild(thumbnailDiv);
    }
    
    // Update total pages
    totalPages--;
    pageCount.textContent = `${totalPages} pages`;
    
    // Reset selected page
    selectedPage = null;
    
    // Disable move buttons
    moveUpBtn.disabled = true;
    moveDownBtn.disabled = true;
}

async function saveChanges() {
    try {
        // Show loading indicator
        const loadingBar = document.getElementById('loadingBar');
        loadingBar.style.opacity = '1';
        loadingBar.style.width = '0';
        
        // Load PDF-lib
        const { PDFDocument, degrees } = PDFLib;
        
        // Load the original PDF
        const arrayBuffer = await pdfFile.arrayBuffer();
        const originalPdfDoc = await PDFDocument.load(arrayBuffer);
        
        // Create a new PDF document
        const newPdfDoc = await PDFDocument.create();
        
        // Copy pages in the new order with rotations
        for (let i = 0; i < pageOrder.length; i++) {
            const pageNum = pageOrder[i];
            const rotation = pageRotations[pageNum];
            
            // Copy the page
            const [copiedPage] = await newPdfDoc.copyPages(originalPdfDoc, [pageNum - 1]);
            
            // Apply rotation if needed
            if (rotation !== 0) {
                copiedPage.setRotation(degrees(rotation));
            }
            
            // Add the page to the new document
            newPdfDoc.addPage(copiedPage);
            
            // Update loading bar
            loadingBar.style.width = `${((i + 1) / pageOrder.length) * 100}%`;
        }
        
        // Save the new PDF
        const newPdfBytes = await newPdfDoc.save();
        
        // Create a download link
        const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `organized_${pdfFile.name}`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Hide loading indicator
        setTimeout(() => {
            loadingBar.style.opacity = '0';
            alert('PDF successfully organized and downloaded!');
        }, 500);
    } catch (error) {
        console.error('Error saving PDF:', error);
        alert('Error saving PDF. Please try again.');
    }
}