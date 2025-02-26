import pikepdf
import pymupdf as fitz  # Using pymupdf with alias fitz
import io
from PIL import Image

def compress_pdf(input_bytes, level='medium'):
    """
    Compress a PDF file using pikepdf and reduce image size using PyMuPDF (fitz) and PIL for JPEG compression.
    
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
            pdf.save(
                temp_output,
                linearize=True,         # Improves loading for web viewing
                compress_streams=True   # Compresses content streams
            )
        temp_output.seek(0)

        # Step 2: Reduce image sizes using PyMuPDF and PIL
        doc = fitz.open(stream=temp_output, filetype="pdf")
        
        # Define quality settings for JPEG compression via PIL
        quality_settings = {
            'low': 80,      # Better quality (less compression)
            'medium': 50,   # Balanced quality and size
            'high': 30      # More compression (lower quality)
        }
        image_quality = quality_settings.get(level, 50)

        for page in doc:
            for img in page.get_images(full=True):
                xref = img[0]  # Get the image reference (xref)
                pix = fitz.Pixmap(doc, xref)
                # Process only RGB or grayscale images
                if pix.n < 5:
                    # Determine the mode: 'L' for grayscale, 'RGB' for others
                    mode = "L" if pix.n == 1 else "RGB"
                    # Create a PIL image from the Pixmap data
                    pil_img = Image.frombytes(mode, (pix.width, pix.height), pix.samples)
                    # Save the PIL image to a bytes buffer as JPEG with specified quality
                    buffer = io.BytesIO()
                    pil_img.save(buffer, format="JPEG", quality=image_quality)
                    img_bytes = buffer.getvalue()
                    buffer.close()
                    # Replace the original image in the PDF with the compressed JPEG using update_stream
                    doc.update_stream(xref, img_bytes)
                # Clean up the Pixmap resources
                pix = None

        # Save the modified PDF to an output stream
        output_stream = io.BytesIO()
        doc.save(output_stream, garbage=4, deflate=True)  # Further optimization
        doc.close()

        compressed_bytes = output_stream.getvalue()
        return original_size, compressed_bytes

    except Exception as e:
        raise Exception(f"Compression failed: {str(e)}")