import pikepdf
import pymupdf as fitz  # Using pymupdf with alias fitz
import io
from PIL import Image

def compress_pdf(input_bytes, level='medium'):
    """
    Compress a PDF file using pikepdf and reduce image size using PyMuPDF (fitz) and PIL for compression.
    
    Args:
        input_bytes: The input PDF as bytes.
        level: 'low' (better quality), 'medium' (balanced), 'high' (smaller size).
        
    Returns:
        Tuple of (original_size, compressed_bytes)
    """
    try:
        original_size = len(input_bytes)

        # Step 1: Optimize PDF streams with pikepdf
        input_stream = io.BytesIO(input_bytes)
        temp_output = io.BytesIO()
        with pikepdf.open(input_stream) as pdf:
            # Apply advanced PDF optimization
            pdf.save(
                temp_output,
                linearize=True,         # Improves loading for web viewing
                compress_streams=True   # Compresses content streams
            )
        temp_output.seek(0)

        # Step 2: Reduce image sizes using PyMuPDF and PIL
        doc = fitz.open(stream=temp_output, filetype="pdf")
        
        # Enhanced quality settings for better compression
        quality_settings = {
            'low': 70,      # Better quality (more compression)
            'medium': 45,   # Balanced quality and size
            'high': 25      # Maximum compression
        }
        image_quality = quality_settings.get(level, 45)

        for page in doc:
            for img in page.get_images(full=True):
                xref = img[0]  # Get the image reference
                base_image = doc.extract_image(xref)
                
                if not base_image:
                    continue
                    
                # Get original image format and data
                img_format = base_image["ext"].upper()
                img_bytes = base_image["image"]
                
                # Skip if image is already well-compressed
                if len(img_bytes) < 10000:  # Skip small images
                    continue
                    
                try:
                    # Open image with PIL
                    with Image.open(io.BytesIO(img_bytes)) as pil_img:
                        # Convert CMYK to RGB if necessary
                        if pil_img.mode == 'CMYK':
                            pil_img = pil_img.convert('RGB')
                            
                        # Determine output format
                        out_format = img_format if img_format in ['PNG', 'WEBP'] else 'JPEG'
                        
                        # Prepare compression parameters
                        save_params = {}
                        if out_format == 'JPEG':
                            save_params['quality'] = image_quality
                            save_params['optimize'] = True
                        elif out_format == 'PNG':
                            save_params['optimize'] = True
                        elif out_format == 'WEBP':
                            save_params['quality'] = image_quality
                            save_params['method'] = 6  # Maximum compression
                        
                        # Save compressed image
                        buffer = io.BytesIO()
                        pil_img.save(buffer, format=out_format, **save_params)
                        compressed_bytes = buffer.getvalue()
                        buffer.close()
                        
                        # Only update if compression was effective
                        if len(compressed_bytes) < len(img_bytes):
                            doc.update_stream(xref, compressed_bytes)
                except Exception as img_err:
                    print(f"Warning: Could not process image: {img_err}")
                    continue

        # Save the modified PDF with maximum compression
        output_stream = io.BytesIO()
        doc.save(output_stream,
                 garbage=4,     # Maximum garbage collection
                 deflate=True,  # Use deflate compression
                 clean=True)    # Clean unused elements
        doc.close()

        compressed_bytes = output_stream.getvalue()
        return original_size, compressed_bytes

        # Save the modified PDF to an output stream
        output_stream = io.BytesIO()
        doc.save(output_stream, garbage=4, deflate=True)  # Further optimization
        doc.close()

        compressed_bytes = output_stream.getvalue()
        return original_size, compressed_bytes

    except Exception as e:
        raise Exception(f"Compression failed: {str(e)}")