document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const pageCount = document.getElementById('pageCount');
    const convertOptions = document.getElementById('convertOptions');
    const pagePreview = document.getElementById('pagePreview');
    const convertBtn = document.getElementById('convertBtn');
    const loadingBar = document.getElementById('loadingBar');
    let pdfDoc = null;

    // Set up PDF.js worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

    // Drag and drop handlers
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
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            processPDFFile(file);
        } else {
            alert('Please drop a valid PDF file.');
        }
    });

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            processPDFFile(file);
        }
    });

    async function processPDFFile(file) {
        try {
            // Update file info
            fileName.textContent = file.name;
            fileSize.textContent = formatBytes(file.size);
            fileInfo.style.display = 'block';
            loadingBar.style.width = '20%';

            // Load the PDF file
            const arrayBuffer = await file.arrayBuffer();
            pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
            pageCount.textContent = `${pdfDoc.numPages} pages`;
            loadingBar.style.width = '40%';

            // Generate previews
            await generatePreviews();
            loadingBar.style.width = '70%';

            // Show convert options
            convertOptions.style.display = 'block';
            convertBtn.disabled = false;
            loadingBar.style.width = '100%';

            setTimeout(() => {
                loadingBar.style.width = '0';
            }, 1000);
        } catch (error) {
            console.error('Error processing PDF:', error);
            alert('Error processing PDF file. Please try again.');
            loadingBar.style.width = '0';
        }
    }

    async function generatePreviews() {
        pagePreview.innerHTML = '';
        const maxPreviews = Math.min(pdfDoc.numPages, 12); // Limit preview to first 12 pages

        for (let i = 1; i <= maxPreviews; i++) {
            try {
                const page = await pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: 0.3 }); // Adjust scale for thumbnail size

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

                const previewDiv = document.createElement('div');
                previewDiv.className = 'page-preview';
                previewDiv.innerHTML = `
                    <img src="${canvas.toDataURL()}" alt="Page ${i}">
                    <div class="page-number">Page ${i}</div>
                `;

                pagePreview.appendChild(previewDiv);
            } catch (error) {
                console.error(`Error generating preview for page ${i}:`, error);
            }
        }

        if (pdfDoc.numPages > maxPreviews) {
            const morePages = document.createElement('div');
            morePages.className = 'page-preview more-pages';
            morePages.innerHTML = `<div class="more-pages-text">+${pdfDoc.numPages - maxPreviews} more pages</div>`;
            pagePreview.appendChild(morePages);
        }
    }

    convertBtn.addEventListener('click', async () => {
        if (!pdfDoc) {
            alert('Please select a PDF file first.');
            return;
        }

        try {
            loadingBar.style.width = '20%';
            const format = document.getElementById('imageFormat').value;
            const quality = document.getElementById('imageQuality').value;
            const dpi = parseInt(document.getElementById('dpi').value);

            if (!format || !quality || isNaN(dpi)) {
                throw new Error('Invalid conversion settings');
            }

            // Create a zip file to store all images
            const zip = new JSZip();
            const totalPages = pdfDoc.numPages;

            for (let i = 1; i <= totalPages; i++) {
                try {
                    const page = await pdfDoc.getPage(i);
                    const scale = dpi / 72; // Convert DPI to scale factor
                    const viewport = page.getViewport({ scale });

                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;

                    await page.render({
                        canvasContext: context,
                        viewport: viewport
                    }).promise;

                    // Convert canvas to blob with proper error handling
                    const imageQualityValue = {
                        high: 1.0,
                        medium: 0.75,
                        low: 0.5
                    }[quality] || 0.75; // Default to medium if invalid

                    const blob = await new Promise((resolve, reject) => {
                        canvas.toBlob(
                            (blob) => {
                                if (blob) {
                                    resolve(blob);
                                } else {
                                    reject(new Error(`Failed to create image for page ${i}`));
                                }
                            },
                            `image/${format}`,
                            imageQualityValue
                        );
                    });

                    // Add to zip
                    zip.file(`page_${i}.${format}`, blob);

                    // Update progress
                    loadingBar.style.width = `${20 + (i / totalPages) * 60}%`;
                } catch (error) {
                    console.error(`Error converting page ${i}:`, error);
                    throw new Error(`Failed to convert page ${i}: ${error.message}`);
                }
            }

            // Generate and download zip file
            loadingBar.style.width = '90%';
            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `converted_pages.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            loadingBar.style.width = '100%';
            setTimeout(() => {
                loadingBar.style.width = '0';
            }, 1000);
        } catch (error) {
            console.error('Error converting PDF to images:', error);
            alert(`Error converting PDF to images: ${error.message}. Please try again.`);
            loadingBar.style.width = '0';
        }
    });

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Back to top button functionality
    const backToTop = document.getElementById('backToTop');
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
});