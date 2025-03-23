from pathlib import Path
import pdfkit
import os
import tempfile
from typing import Union, Optional
from werkzeug.datastructures import FileStorage

class HTMLService:
    def __init__(self):
        # Configure PDF options for different quality levels
        self.pdf_options = {
            'high': {
                'quality': 100,
                'dpi': 300,
                'image-quality': 100,
                'enable-local-file-access': True,
                'encoding': 'UTF-8'
            },
            'medium': {
                'quality': 75,
                'dpi': 200,
                'image-quality': 75,
                'enable-local-file-access': True,
                'encoding': 'UTF-8'
            },
            'low': {
                'quality': 50,
                'dpi': 150,
                'image-quality': 50,
                'enable-local-file-access': True,
                'encoding': 'UTF-8'
            }
        }

    def convert_html_to_pdf(self, 
                           input_source: Union[str, FileStorage], 
                           output_path: str,
                           quality: str = 'high',
                           is_url: bool = False) -> tuple[bool, str]:
        """
        Convert HTML to PDF using pdfkit (wkhtmltopdf wrapper)
        
        Args:
            input_source: HTML file path, content, or URL
            output_path: Path where the PDF will be saved
            quality: Quality level ('high', 'medium', 'low')
            is_url: Whether the input_source is a URL

        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            # Ensure output directory exists
            os.makedirs(os.path.dirname(output_path), exist_ok=True)

            # Get quality settings
            options = self.pdf_options.get(quality.lower(), self.pdf_options['high'])

            if is_url:
                # Convert from URL
                pdfkit.from_url(input_source, output_path, options=options)
            elif isinstance(input_source, FileStorage):
                # Convert from uploaded file
                with tempfile.NamedTemporaryFile(suffix='.html', delete=False) as temp_file:
                    input_source.save(temp_file)
                    temp_file.flush()
                    pdfkit.from_file(temp_file.name, output_path, options=options)
                # Clean up temp file
                os.unlink(temp_file.name)
            else:
                # Convert from file path or HTML string
                if os.path.isfile(input_source):
                    pdfkit.from_file(input_source, output_path, options=options)
                else:
                    pdfkit.from_string(input_source, output_path, options=options)

            if not os.path.exists(output_path):
                return False, "PDF generation failed"

            return True, "PDF generated successfully"

        except Exception as e:
            return False, f"Error converting HTML to PDF: {str(e)}"

    def validate_html_file(self, file: FileStorage) -> tuple[bool, str]:
        """
        Validate HTML file before processing
        
        Args:
            file: Uploaded HTML file

        Returns:
            tuple: (is_valid: bool, message: str)
        """
        if not file:
            return False, "No file provided"

        # Check file extension
        filename = file.filename.lower()
        if not filename.endswith(('.html', '.htm')):
            return False, "Invalid file type. Only HTML files are allowed"

        # Check file size (e.g., limit to 10MB)
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)
        if size > 10 * 1024 * 1024:  # 10MB
            return False, "File too large. Maximum size is 10MB"

        return True, "File is valid"

    def cleanup_temp_files(self, file_path: str) -> None:
        """
        Clean up temporary files after processing
        
        Args:
            file_path: Path to the temporary file
        """
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            pass  # Silently fail if cleanup fails