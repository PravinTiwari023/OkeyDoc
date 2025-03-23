from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
import io
import logging
from services.pdf_service import compress_pdf, split_pdf, merge_pdfs, parse_page_ranges
from models.pdf_model import PDFFile
import base64
from services.word_service import word_to_pdf_service, pdf_to_word_service
from services.ppt_service import ppt_to_pdf_service, pdf_to_ppt_service
from services.excel_service import excel_to_pdf_service, pdf_to_excel_service
from services.html_service import HTMLService
import os

# Configure logging
logger = logging.getLogger(__name__)

# Create a Blueprint for API routes
api_bp = Blueprint('api', __name__, url_prefix='/api')

# HTML to PDF Conversion Endpoint
@api_bp.route('/html2pdf', methods=['POST'])
def html_to_pdf_endpoint():
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            logger.error('No URL provided')
            return jsonify({'error': 'No URL provided'}), 400

        url = data['url']
        quality = data.get('quality', 'high')

        if quality not in ['low', 'medium', 'high']:
            logger.error('Invalid quality level: %s', quality)
            return jsonify({'error': 'Invalid quality level'}), 400

        # Create temporary file for output
        output_path = os.path.join(os.getcwd(), 'temp', f'{secure_filename("output")}.pdf')
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        try:
            # Initialize HTML service and convert URL to PDF
            html_service = HTMLService()
            success, message = html_service.convert_html_to_pdf(
                input_source=url,
                output_path=output_path,
                quality=quality,
                is_url=True
            )

            if not success:
                logger.error('Conversion failed: %s', message)
                return jsonify({'error': message}), 500

            # Read the generated PDF
            with open(output_path, 'rb') as pdf_file:
                pdf_content = pdf_file.read()

            return send_file(
                io.BytesIO(pdf_content),
                mimetype='application/pdf',
                as_attachment=True,
                download_name='converted.pdf'
            )

        finally:
            # Clean up temporary file
            try:
                if os.path.exists(output_path):
                    os.remove(output_path)
            except Exception as cleanup_error:
                logger.error('Error cleaning up temporary file: %s', str(cleanup_error))

    except Exception as e:
        logger.error('Error in HTML to PDF conversion: %s', str(e))
        return jsonify({'error': str(e)}), 500

# PDF Compression Endpoint
@api_bp.route('/compress', methods=['POST'])
def compress_pdf_endpoint():
    try:
        if 'pdf' not in request.files:
            logger.error('No file part in request')
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['pdf']
        
        if file.filename == '':
            logger.error('No selected file')
            return jsonify({'error': 'No selected file'}), 400
        
        if not file or not PDFFile.allowed_file(file.filename):
            logger.error('Invalid file format: %s', file.filename)
            return jsonify({'error': 'Invalid file format'}), 400

        # Get compression level from form data
        compression_level = request.form.get('level', 'medium')
        if compression_level not in ['low', 'medium', 'high']:
            logger.error('Invalid compression level: %s', compression_level)
            return jsonify({'error': 'Invalid compression level'}), 400
        
        # Read file into memory
        input_pdf_bytes = file.read()
        
        logger.info('Compressing file: %s with level: %s', file.filename, compression_level)
        
        # Use compress function from service
        original_size, compressed_bytes = compress_pdf(input_pdf_bytes, compression_level)
        
        logger.info('Compression successful: Original size %d, Compressed size %d', 
                    original_size, len(compressed_bytes))
        
        # Create BytesIO object from compressed bytes
        compressed_io = io.BytesIO(compressed_bytes)
        compressed_io.seek(0)
        
        # Return compressed file
        filename = secure_filename(file.filename)
        response = send_file(
            compressed_io,
            as_attachment=True,
            download_name=f"compressed_{filename}",
            mimetype='application/pdf'
        )
        response.headers['X-Original-Size'] = str(original_size)
        response.headers['X-Compressed-Size'] = str(len(compressed_bytes))
        return response, 200

    except Exception as e:
        logger.error('Compression failed: %s', str(e))
        return jsonify({'error': str(e)}), 500

# PDF to Word Conversion Endpoint
@api_bp.route('/pdf-to-word', methods=['POST'])
def pdf_to_word_endpoint():
    try:
        if 'pdf' not in request.files:
            logger.error('No file part in request')
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['pdf']
        
        if file.filename == '':
            logger.error('No selected file')
            return jsonify({'error': 'No selected file'}), 400
        
        if not file or not PDFFile.allowed_file(file.filename):
            logger.error('Invalid file format: %s', file.filename)
            return jsonify({'error': 'Invalid file format'}), 400

        # Get output format from form data
        output_format = request.form.get('format', 'docx')
        if output_format not in ['docx', 'doc']:
            logger.error('Invalid output format: %s', output_format)
            return jsonify({'error': 'Invalid output format'}), 400
        
        # Read file into memory
        input_pdf_bytes = file.read()
        
        logger.info('Converting PDF to Word: %s with format: %s', file.filename, output_format)
        
        # Use pdf_to_word_service function
        word_bytes = pdf_to_word_service(input_pdf_bytes, output_format)
        
        # Create BytesIO object from word bytes
        word_io = io.BytesIO(word_bytes)
        word_io.seek(0)
        
        # Return word file
        filename = secure_filename(file.filename)
        base_name = os.path.splitext(filename)[0]
        response = send_file(
            word_io,
            as_attachment=True,
            download_name=f"{base_name}.{output_format}",
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document' if output_format == 'docx' else 'application/msword'
        )
        return response, 200

    except Exception as e:
        logger.error('PDF to Word conversion failed: %s', str(e))
        return jsonify({'error': str(e)}), 500

# PDF Split Endpoint
@api_bp.route('/split', methods=['POST'])
def split_pdf_endpoint():
    try:
        if 'pdf' not in request.files:
            logger.error('No file part in split request')
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['pdf']
        
        if file.filename == '':
            logger.error('No selected file for split')
            return jsonify({'error': 'No selected file'}), 400
        
        if not file or not PDFFile.allowed_file(file.filename):
            logger.error('Invalid file format for split: %s', file.filename)
            return jsonify({'error': 'Invalid file format'}), 400

        # Read file into memory
        input_pdf_bytes = file.read()
        
        split_type = request.form.get('splitType', 'all')
        page_range = request.form.get('pageRange', '')
        
        logger.info('Splitting file: %s with type: %s', file.filename, split_type)
        
        # Use split_pdf function from service
        output_bytes = split_pdf(input_pdf_bytes, split_type, page_range)
        
        # Create BytesIO object
        output_pdf = io.BytesIO(output_bytes)
        output_pdf.seek(0)
        
        logger.info('Split successful')
        return send_file(
            output_pdf,
            as_attachment=True,
            download_name=f"split_{secure_filename(file.filename)}",
            mimetype='application/pdf'
        )

    except Exception as e:
        logger.error('Splitting failed: %s', str(e))
        return jsonify({'error': f'Splitting failed: {str(e)}'}), 500

# PDF Merge Endpoint
@api_bp.route('/merge', methods=['POST'])
def merge_pdfs_endpoint():
    try:
        if 'pdfs' not in request.files:
            logger.error('No files part in merge request')
            return jsonify({'error': 'No files part'}), 400
        
        files = request.files.getlist('pdfs')
        
        if not files or all(f.filename == '' for f in files):
            logger.error('No selected files for merge')
            return jsonify({'error': 'No selected files'}), 400
        
        valid_files = [f for f in files if f and PDFFile.allowed_file(f.filename)]
        
        if not valid_files:
            logger.error('Invalid file format for merge')
            return jsonify({'error': 'Invalid file format'}), 400
        
        # Process all PDFs in memory
        pdf_bytes_list = []
        for f in valid_files:
            pdf_bytes = f.read()
            pdf_bytes_list.append(pdf_bytes)
        
        # Use merge_pdfs function from service
        output_bytes = merge_pdfs(pdf_bytes_list)
        
        # Create BytesIO object
        output_pdf = io.BytesIO(output_bytes)
        output_pdf.seek(0)
        
        logger.info('Merge successful')
        return send_file(
            output_pdf,
            as_attachment=True,
            download_name='merged-document.pdf',
            mimetype='application/pdf'
        )
    except Exception as e:
        logger.error('Merging failed: %s', str(e))
        return jsonify({'error': 'Merging failed: ' + str(e)}), 500

# Word to PDF Conversion Endpoint
@api_bp.route('/word-to-pdf', methods=['POST'])
def word_to_pdf_endpoint():
    try:
        if 'word' not in request.files:
            logger.error('No file part in request')
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['word']
        
        if file.filename == '':
            logger.error('No selected file')
            return jsonify({'error': 'No selected file'}), 400
        
        if not file or not file.filename.lower().endswith(('.doc', '.docx')):
            logger.error('Invalid file format: %s', file.filename)
            return jsonify({'error': 'Invalid file format'}), 400

        # Get quality level from form data
        quality = request.form.get('quality', 'high')
        if quality not in ['low', 'medium', 'high']:
            logger.error('Invalid quality level: %s', quality)
            return jsonify({'error': 'Invalid quality level'}), 400
        
        # Convert the Word document to PDF
        logger.info('Converting %s to PDF with quality %s', file.filename, quality)
        converted_bytes = word_to_pdf_service(file.read(), quality)
        
        # Create BytesIO object from converted bytes
        output_pdf = io.BytesIO(converted_bytes)
        output_pdf.seek(0)
        
        # Return converted file
        filename = secure_filename(file.filename)
        logger.info('Successfully converted %s to PDF', file.filename)
        return send_file(
            output_pdf,
            as_attachment=True,
            download_name=f"{filename.rsplit('.', 1)[0]}.pdf",
            mimetype='application/pdf'
        )

    except Exception as e:
        logger.error('Word to PDF conversion failed for %s: %s', file.filename, str(e))
        return jsonify({'error': f"Failed to convert {file.filename}. Please ensure it's a valid Word document."}), 500

# PowerPoint to PDF Conversion Endpoint
@api_bp.route('/ppt-to-pdf', methods=['POST'])
def ppt_to_pdf_endpoint():
    try:
        if 'ppt' not in request.files:
            logger.error('No file part in request')
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['ppt']
        
        if file.filename == '':
            logger.error('No selected file')
            return jsonify({'error': 'No selected file'}), 400
        
        if not file or not file.filename.lower().endswith(('.ppt', '.pptx')):
            logger.error('Invalid file format: %s', file.filename)
            return jsonify({'error': 'Invalid file format'}), 400

        # Get quality level from form data
        quality = request.form.get('quality', 'high')
        if quality not in ['low', 'medium', 'high']:
            logger.error('Invalid quality level: %s', quality)
            return jsonify({'error': 'Invalid quality level'}), 400
        
        # Convert the PowerPoint document to PDF
        logger.info('Converting %s to PDF with quality %s', file.filename, quality)
        converted_bytes = ppt_to_pdf_service(file.read(), quality)
        
        # Create BytesIO object from converted bytes
        output_pdf = io.BytesIO(converted_bytes)
        output_pdf.seek(0)
        
        # Return converted file
        filename = secure_filename(file.filename)
        logger.info('Successfully converted %s to PDF', file.filename)
        return send_file(
            output_pdf,
            as_attachment=True,
            download_name=f"{filename.rsplit('.', 1)[0]}.pdf",
            mimetype='application/pdf'
        )

    except Exception as e:
        logger.error('PowerPoint to PDF conversion failed for %s: %s', file.filename, str(e))
        return jsonify({'error': f"Failed to convert {file.filename}. Please ensure it's a valid PowerPoint document."}), 500
@api_bp.route('/excel-to-pdf', methods=['POST'])
def excel_to_pdf_endpoint():
    try:
        if 'excel' not in request.files:
            logger.error('No file part in request')
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['excel']
        
        if file.filename == '':
            logger.error('No selected file')
            return jsonify({'error': 'No selected file'}), 400
        
        if not file or not file.filename.lower().endswith(('.xls', '.xlsx')):
            logger.error('Invalid file format: %s', file.filename)
            return jsonify({'error': 'Invalid file format'}), 400

        # Get quality level from form data
        quality = request.form.get('quality', 'high')
        if quality not in ['low', 'medium', 'high']:
            logger.error('Invalid quality level: %s', quality)
            return jsonify({'error': 'Invalid quality level'}), 400
        
        # Convert the Excel document to PDF
        logger.info('Converting %s to PDF with quality %s', file.filename, quality)
        converted_bytes = excel_to_pdf_service(file.read(), quality)
        
        # Create BytesIO object from converted bytes
        output_pdf = io.BytesIO(converted_bytes)
        output_pdf.seek(0)
        
        # Return converted file
        filename = secure_filename(file.filename)
        logger.info('Successfully converted %s to PDF', file.filename)
        return send_file(
            output_pdf,
            as_attachment=True,
            download_name=f"{filename.rsplit('.', 1)[0]}.pdf",
            mimetype='application/pdf'
        )

    except Exception as e:
        logger.error('Excel to PDF conversion failed for %s: %s', file.filename, str(e))
        return jsonify({'error': f"Failed to convert {file.filename}. Please ensure it's a valid Excel document."}), 500

@api_bp.route('/pdf-to-excel', methods=['POST'])
def pdf_to_excel_endpoint():
    try:
        if 'pdf' not in request.files:
            logger.error('No file part in request')
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['pdf']
        
        if file.filename == '':
            logger.error('No selected file')
            return jsonify({'error': 'No selected file'}), 400
        
        if not file or not file.filename.lower().endswith('.pdf'):
            logger.error('Invalid file format: %s', file.filename)
            return jsonify({'error': 'Invalid file format'}), 400

        # Get quality level from form data
        quality = request.form.get('quality', 'high')
        if quality not in ['low', 'medium', 'high']:
            logger.error('Invalid quality level: %s', quality)
            return jsonify({'error': 'Invalid quality level'}), 400
        
        # Convert PDF to Excel
        logger.info('Converting %s to Excel with quality %s', file.filename, quality)
        converted_bytes = pdf_to_excel_service(file.read(), quality)
        
        # Create BytesIO object from converted bytes
        output_excel = io.BytesIO(converted_bytes)
        output_excel.seek(0)
        
        # Return converted file
        filename = secure_filename(file.filename)
        logger.info('Successfully converted %s to Excel', file.filename)
        return send_file(
            output_excel,
            as_attachment=True,
            download_name=f"{filename.rsplit('.', 1)[0]}.xlsx",
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )

    except Exception as e:
        logger.error('PDF to Excel conversion failed for %s: %s', file.filename, str(e))
        return jsonify({'error': f"Failed to convert {file.filename}. Please ensure it's a valid PDF document."}), 500

@api_bp.route('/pdf-to-ppt', methods=['POST'])
def pdf_to_ppt_endpoint():
    try:
        if 'pdf' not in request.files:
            logger.error('No file part in request')
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['pdf']
        
        if file.filename == '':
            logger.error('No selected file')
            return jsonify({'error': 'No selected file'}), 400
        
        if not file or not file.filename.lower().endswith('.pdf'):
            logger.error('Invalid file format: %s', file.filename)
            return jsonify({'error': 'Invalid file format'}), 400

        # Get quality level from form data
        quality = request.form.get('quality', 'high')
        if quality not in ['low', 'medium', 'high']:
            logger.error('Invalid quality level: %s', quality)
            return jsonify({'error': 'Invalid quality level'}), 400
        
        # Convert the PDF document to PowerPoint
        logger.info('Converting %s to PowerPoint with quality %s', file.filename, quality)
        converted_bytes = pdf_to_ppt_service(file.read(), quality)
        
        # Create BytesIO object from converted bytes
        output_pptx = io.BytesIO(converted_bytes)
        output_pptx.seek(0)
        
        # Return converted file
        filename = secure_filename(file.filename)
        logger.info('Successfully converted %s to PowerPoint', file.filename)
        return send_file(
            output_pptx,
            as_attachment=True,
            download_name=f"{filename.rsplit('.', 1)[0]}.pptx",
            mimetype='application/vnd.openxmlformats-officedocument.presentationml.presentation'
        )

    except Exception as e:
        logger.error('PDF to PowerPoint conversion failed for %s: %s', file.filename, str(e))
        return jsonify({'error': f"Failed to convert {file.filename}. Please ensure it's a valid PDF document."}), 500