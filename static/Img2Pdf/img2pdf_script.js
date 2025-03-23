document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileCount = document.getElementById('fileCount');
    const totalSize = document.getElementById('totalSize');
    const organizeOptions = document.getElementById('organizeOptions');
    const imagePreview = document.getElementById('imagePreview');
    const convertBtn = document.getElementById('convertBtn');
    const loadingBar = document.getElementById('loadingBar');
    let images = [];

    // Initialize Sortable for image reordering
    new Sortable(imagePreview, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: updateImageOrder
    });

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
        handleFiles(e.dataTransfer.files);
    });

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    function handleFiles(files) {
        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (imageFiles.length === 0) return;

        images = images.concat(imageFiles);
        updateFileInfo();
        updateImagePreviews();
        showOptions();
    }

    function updateFileInfo() {
        fileInfo.style.display = 'block';
        fileCount.textContent = `${images.length} image${images.length !== 1 ? 's' : ''}`;
        const totalBytes = images.reduce((acc, img) => acc + img.size, 0);
        totalSize.textContent = formatBytes(totalBytes);
    }

    function updateImagePreviews() {
        imagePreview.innerHTML = '';
        images.forEach((image, index) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const thumbnail = createThumbnail(e.target.result, index);
                imagePreview.appendChild(thumbnail);
            };
            reader.readAsDataURL(image);
        });
        convertBtn.disabled = images.length === 0;
    }

    function createThumbnail(src, index) {
        const div = document.createElement('div');
        div.className = 'page-thumbnail';
        div.dataset.index = index;

        const img = document.createElement('img');
        img.src = src;
        img.alt = `Image ${index + 1}`;

        const controls = document.createElement('div');
        controls.className = 'thumbnail-controls';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'control-btn';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            images.splice(index, 1);
            updateFileInfo();
            updateImagePreviews();
        };

        const pageNumber = document.createElement('div');
        pageNumber.className = 'page-number';
        pageNumber.textContent = index + 1;

        div.appendChild(img);
        controls.appendChild(removeBtn);
        div.appendChild(controls);
        div.appendChild(pageNumber);

        return div;
    }

    function updateImageOrder() {
        const newImages = [];
        imagePreview.querySelectorAll('.page-thumbnail').forEach((thumbnail, newIndex) => {
            const oldIndex = parseInt(thumbnail.dataset.index);
            newImages.push(images[oldIndex]);
            thumbnail.dataset.index = newIndex;
        });
        images = newImages;
        updateImagePreviews();
    }

    function showOptions() {
        organizeOptions.style.display = 'block';
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    function getPageDimensions(size, orientation) {
        const dimensions = {
            a4: [595.276, 841.890],
            letter: [612, 792],
            legal: [612, 1008],
            a3: [841.890, 1190.551]
        };

        const [width, height] = dimensions[size] || dimensions.a4;
        return orientation === 'landscape' ? [height, width] : [width, height];
    }

    convertBtn.addEventListener('click', async () => {
        if (images.length === 0) return;

        try {
            loadingBar.style.width = '30%';
            const orientation = document.querySelector('input[name="orientation"]:checked').value;
            const pageSize = document.getElementById('pageSize').value;

            const pdfDoc = await PDFLib.PDFDocument.create();
            loadingBar.style.width = '50%';

            for (let i = 0; i < images.length; i++) {
                const image = images[i];
                
                try {
                    const imageBytes = await readFileAsArrayBuffer(image);
                    let embeddedImage;

                    if (image.type === 'image/jpeg') {
                        embeddedImage = await pdfDoc.embedJpg(imageBytes);
                    } else if (image.type === 'image/png') {
                        embeddedImage = await pdfDoc.embedPng(imageBytes);
                    } else {
                        throw new Error(`Unsupported image format: ${image.type}`);
                    }

                    const pageDimensions = getPageDimensions(pageSize, orientation === 'auto' ? 
                        (embeddedImage.width > embeddedImage.height ? 'landscape' : 'portrait') : 
                        orientation);

                    const page = pdfDoc.addPage(pageDimensions);
                    const { width, height } = page.getSize();
                    const scale = Math.min(
                        width / embeddedImage.width,
                        height / embeddedImage.height
                    );

                    page.drawImage(embeddedImage, {
                        x: (width - embeddedImage.width * scale) / 2,
                        y: (height - embeddedImage.height * scale) / 2,
                        width: embeddedImage.width * scale,
                        height: embeddedImage.height * scale
                    });

                    loadingBar.style.width = `${50 + (i + 1) * (40 / images.length)}%`;
                } catch (imageError) {
                    console.error(`Error processing image ${i + 1}:`, imageError);
                    throw new Error(`Failed to process image ${i + 1}: ${imageError.message}`);
                }
            }

            const pdfBytes = await pdfDoc.save();
            loadingBar.style.width = '100%';

            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'converted_images.pdf';
            a.click();
            URL.revokeObjectURL(url);

            setTimeout(() => {
                loadingBar.style.width = '0';
            }, 1200);
        } catch (error) {
            console.error('Error converting images to PDF:', error);
            loadingBar.style.width = '0';
            alert(error.message || 'Error converting images to PDF. Please try again.');
        }
    });

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