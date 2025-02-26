from flask import Flask, render_template, request, send_file, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import io
from datetime import datetime
from compress import compress_pdf  # Import the updated compress function
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes (restrict in production if needed)

# Serve static files (CSS, JS) from the static folder
app.static_folder = 'static'

# Allowed file extensions
ALLOWED_EXTENSIONS = {'pdf'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Routes for HTML pages
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/pdf_merge')
def pdf_merge():
    return render_template('pdf_merge.html')

@app.route('/pdf_split')
def pdf_split():
    return render_template('pdf_split.html')

@app.route('/pdf_compress')
def pdf_compress():
    return render_template('pdf_compress.html')

# PDF Compression Endpoint (in-memory processing)
@app.route('/compress', methods=['POST'])
def compress_pdf_endpoint():
    try:
        if 'pdf' not in request.files:
            logger.error('No file part in request')
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['pdf']
        
        if file.filename == '':
            logger.error('No selected file')
            return jsonify({'error': 'No selected file'}), 400
        
        if not file or not allowed_file(file.filename):
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
        
        # Use updated compress function
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
        response.headers['X-Compressed-Size'] = str(len(compressed_bytes))  # FIXED ERROR
        return response, 200

    except Exception as e:
        logger.error('Compression failed: %s', str(e))
        return jsonify({'error': str(e)}), 500

# PDF Split Endpoint (in-memory processing, unchanged for this fix)
@app.route('/split', methods=['POST'])
def split_pdf():
    try:
        if 'pdf' not in request.files:
            logger.error('No file part in split request')
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['pdf']
        
        if file.filename == '':
            logger.error('No selected file for split')
            return jsonify({'error': 'No selected file'}), 400
        
        if not file or not allowed_file(file.filename):
            logger.error('Invalid file format for split: %s', file.filename)
            return jsonify({'error': 'Invalid file format'}), 400

        # Read file into memory
        input_pdf_bytes = file.read()
        input_pdf_io = io.BytesIO(input_pdf_bytes)
        
        split_type = request.form.get('splitType', 'all')
        page_range = request.form.get('pageRange', '')
        
        logger.info('Splitting file: %s with type: %s', file.filename, split_type)
        
        import pdfplumber
        from PyPDF2 import PdfReader, PdfWriter
        
        # Process PDF in memory
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
                logger.error('Invalid page range for split: %s', page_range)
                return jsonify({'error': 'Invalid page range'}), 400
            
            for page_num in pages:
                # PyPDF2 is 0-indexed, but user input is 1-indexed
                writer.add_page(pdf_reader.pages[page_num - 1])
        
        # Write to memory
        output_pdf = io.BytesIO()
        writer.write(output_pdf)
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

# PDF Merge Endpoint (in-memory processing, unchanged for this fix)
@app.route('/merge', methods=['POST'])
def merge_pdfs():
    try:
        if 'pdfs' not in request.files:
            logger.error('No files part in merge request')
            return jsonify({'error': 'No files part'}), 400
        
        files = request.files.getlist('pdfs')
        
        if not files or all(f.filename == '' for f in files):
            logger.error('No selected files for merge')
            return jsonify({'error': 'No selected files'}), 400
        
        valid_files = [f for f in files if f and allowed_file(f.filename)]
        
        if not valid_files:
            logger.error('Invalid file format for merge')
            return jsonify({'error': 'Invalid file format'}), 400
        
        from PyPDF2 import PdfMerger
        
        merger = PdfMerger()
        
        # Process all PDFs in memory
        for f in valid_files:
            pdf_bytes = f.read()
            pdf_io = io.BytesIO(pdf_bytes)
            merger.append(pdf_io)
        
        # Write the merged PDF to memory
        output_pdf = io.BytesIO()
        merger.write(output_pdf)
        merger.close()
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

def parse_page_ranges(input_str, total_pages):
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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)