import pikepdf
import pymupdf as fitz
import io
import random
from PIL import Image

def compress_pdf(input_bytes, level='medium'):
    """
    Enhanced PDF compression with aggressive image optimization
    
    Args:
        input_bytes: The input PDF as bytes
        level: 'low', 'medium', 'high', or 'extreme'
        
    Returns:
        Tuple of (original_size, compressed_bytes)
    """
    try:
        original_size = len(input_bytes)

        # Step 1: Optimize PDF with pikepdf
        input_stream = io.BytesIO(input_bytes)
        temp_output = io.BytesIO()
        with pikepdf.open(input_stream) as pdf:
            pdf.save(
                temp_output,
                linearize=True,
                compress_streams=True,
                object_stream_mode=pikepdf.ObjectStreamMode.generate
            )
        temp_output.seek(0)

        # Step 2: Enhanced image handling with PyMuPDF
        doc = fitz.open(stream=temp_output, filetype="pdf")
        
        # Improved compression settings
        quality_settings = {
            'low': 60,
            'medium': 35,
            'high': 20,
            'extreme': 10  # Added extreme option
        }
        
        # Resolution downsampling settings (max dimensions)
        max_dimensions = {
            'low': 1200,
            'medium': 900,
            'high': 600,
            'extreme': 400
        }
        
        image_quality = quality_settings.get(level, 35)
        max_dimension = max_dimensions.get(level, 900)
        
        # Track compression stats
        total_original = 0
        total_compressed = 0

        for page_num, page in enumerate(doc):
            for img in page.get_images(full=True):
                xref = img[0]
                base_image = doc.extract_image(xref)
                
                if not base_image:
                    continue
                    
                img_format = base_image["ext"].upper()
                img_bytes = base_image["image"]
                
                # Skip already small images
                if len(img_bytes) < 5000:
                    continue
                    
                try:
                    # Process image with PIL
                    with Image.open(io.BytesIO(img_bytes)) as pil_img:
                        original_size = len(img_bytes)
                        total_original += original_size
                        
                        # Convert CMYK to RGB
                        if pil_img.mode == 'CMYK':
                            pil_img = pil_img.convert('RGB')
                        
                        # Convert to grayscale for high/extreme compression if appropriate
                        if level in ['high', 'extreme'] and not img_format == 'PNG':
                            # Check if image is mostly grayscale already
                            if is_mostly_grayscale(pil_img):
                                pil_img = pil_img.convert('L')
                        
                        # Downsample large images
                        width, height = pil_img.size
                        if width > max_dimension or height > max_dimension:
                            if width > height:
                                new_width = max_dimension
                                new_height = int(height * (max_dimension / width))
                            else:
                                new_height = max_dimension
                                new_width = int(width * (max_dimension / height))
                            pil_img = pil_img.resize((new_width, new_height), Image.LANCZOS)
                        
                        # Determine optimal format
                        out_format = 'JPEG'  # Default to JPEG for most images
                        if img_format == 'PNG' and has_transparency(pil_img):
                            out_format = 'PNG'  # Keep PNG only if it has transparency
                        
                        # Compression parameters
                        save_params = {}
                        if out_format == 'JPEG':
                            save_params['quality'] = image_quality
                            save_params['optimize'] = True
                            save_params['progressive'] = True
                        elif out_format == 'PNG':
                            save_params['optimize'] = True
                            save_params['compress_level'] = 9
                        
                        # Save compressed image
                        buffer = io.BytesIO()
                        pil_img.save(buffer, format=out_format, **save_params)
                        compressed_bytes = buffer.getvalue()
                        buffer.close()
                        
                        # Update if compression was successful
                        if len(compressed_bytes) < len(img_bytes):
                            doc.update_stream(xref, compressed_bytes)
                            total_compressed += len(compressed_bytes)
                except Exception as img_err:
                    print(f"Warning: Image processing error on page {page_num+1}: {img_err}")
                    continue

        # Final PDF optimization
        output_stream = io.BytesIO()
        doc.save(
            output_stream,
            garbage=4,     # Maximum garbage collection
            deflate=True,  # Use deflate compression
            clean=True     # Clean unused elements
        )
        doc.close()

        compressed_bytes = output_stream.getvalue()
        compression_ratio = len(compressed_bytes) / original_size * 100
        print(f"Compression achieved: {compression_ratio:.1f}% of original size")
        
        return original_size, compressed_bytes

    except Exception as e:
        raise Exception(f"Compression failed: {str(e)}")

# Helper functions
def is_mostly_grayscale(image, threshold=0.9):
    """Check if an image is mostly grayscale"""
    if image.mode == 'L':
        return True
        
    # Sample pixels for efficiency
    width, height = image.size
    sample_size = min(1000, width * height)
    
    # Convert to RGB if not already
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    grayscale_count = 0
    for _ in range(sample_size):
        x = int(random.random() * width)
        y = int(random.random() * height)
        r, g, b = image.getpixel((x, y))
        # Check if R, G, B values are close to each other
        if abs(r - g) < 15 and abs(r - b) < 15 and abs(g - b) < 15:
            grayscale_count += 1
    
    return grayscale_count / sample_size > threshold

def has_transparency(image):
    """Check if image has transparency"""
    if image.mode == 'RGBA':
        extrema = image.getextrema()
        if len(extrema) == 4:  # RGBA
            if extrema[3][0] < 255:  # Alpha min < 255
                return True
    return False

def split_pdf(input_bytes, split_type='all', page_range=''):
    """Split PDF into pages based on specified criteria
    
    Args:
        input_bytes: The input PDF as bytes
        split_type: 'all' or 'range'
        page_range: Page range string (e.g., '1-3,5,7-9')
        
    Returns:
        Bytes of the split PDF
    """
    import pdfplumber
    from PyPDF2 import PdfReader, PdfWriter
    
    input_pdf_io = io.BytesIO(input_bytes)
    
    # Get total pages
    with pdfplumber.open(input_pdf_io) as pdf:
        total_pages = len(pdf.pages)
    
    # Reset the BytesIO position
    input_pdf_io.seek(0)
    
    pdf_reader = PdfReader(input_pdf_io)
    writer = PdfWriter()
    
    if split_type == 'all':
        # For now, we'll just extract the first page as an example
        # In a real implementation, you'd create a zip file with all pages
        writer.add_page(pdf_reader.pages[0])
    else:
        pages = parse_page_ranges(page_range, total_pages)
        if not pages:
            raise ValueError(f"Invalid page range: {page_range}")
        
        for page_num in pages:
            # PyPDF2 is 0-indexed, but user input is 1-indexed
            writer.add_page(pdf_reader.pages[page_num - 1])
    
    # Write to memory
    output_pdf = io.BytesIO()
    writer.write(output_pdf)
    output_pdf.seek(0)
    
    return output_pdf.getvalue()

def merge_pdfs(pdf_bytes_list):
    """Merge multiple PDFs into one
    
    Args:
        pdf_bytes_list: List of PDF files as bytes
        
    Returns:
        Bytes of the merged PDF
    """
    from PyPDF2 import PdfMerger
    
    merger = PdfMerger()
    
    # Process all PDFs in memory
    for pdf_bytes in pdf_bytes_list:
        pdf_io = io.BytesIO(pdf_bytes)
        merger.append(pdf_io)
    
    # Write the merged PDF to memory
    output_pdf = io.BytesIO()
    merger.write(output_pdf)
    merger.close()
    output_pdf.seek(0)
    
    return output_pdf.getvalue()

def parse_page_ranges(input_str, total_pages):
    """Parse page range string into a list of page numbers
    
    Args:
        input_str: Page range string (e.g., '1-3,5,7-9')
        total_pages: Total number of pages in the PDF
        
    Returns:
        Sorted list of page numbers
    """
    if not input_str.strip():
        return []
    
    pages = set()
    ranges = input_str.split(',')
    
    for r in ranges:
        r = r.strip()
        if '-' in r:
            start, end = map(int, r.split('-'))
            if 1 <= start <= end <= total_pages:
                pages.update(range(start, end + 1))
        else:
            try:
                page = int(r)
                if 1 <= page <= total_pages:
                    pages.add(page)
            except ValueError:
                # Skip invalid page numbers
                continue
    
    return sorted(list(pages))

def pdf_to_image(input_bytes, image_format='jpg', quality='high', dpi=300):
    """Convert PDF pages to images
    
    Args:
        input_bytes: The input PDF as bytes
        image_format: Output image format ('jpg' or 'png')
        quality: Image quality ('low', 'medium', 'high')
        dpi: Resolution in DPI (150, 200, or 300)
        
    Returns:
        List of image bytes for each page
    """
    try:
        # Quality settings mapping
        quality_settings = {
            'low': 60,
            'medium': 80,
            'high': 95
        }
        
        # Open PDF with PyMuPDF
        doc = fitz.open(stream=input_bytes, filetype="pdf")
        images_data = []
        
        # Process each page
        for page in doc:
            # Get the page's pixmap with specified DPI
            # Convert DPI to zoom factor (72 DPI is the base)
            zoom = dpi / 72.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            
            # Convert pixmap to PIL Image
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            
            # Save image to bytes with specified format and quality
            img_buffer = io.BytesIO()
            save_params = {}
            
            if image_format.lower() == 'jpg':
                save_params['quality'] = quality_settings[quality]
                save_params['optimize'] = True
                img.save(img_buffer, format='JPEG', **save_params)
            else:  # PNG
                save_params['optimize'] = True
                img.save(img_buffer, format='PNG', **save_params)
            
            images_data.append(img_buffer.getvalue())
            img_buffer.close()
        
        doc.close()
        return images_data
        
    except Exception as e:
        raise Exception(f"PDF to Image conversion failed: {str(e)}")