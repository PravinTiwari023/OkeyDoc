from flask import Blueprint, render_template

# Create a Blueprint for page routes
page_bp = Blueprint('page', __name__)

# Home page route
@page_bp.route('/')
def home():
    return render_template('index.html')

# Routes for Organize PDF pages
@page_bp.route('/pdf_merge')
def pdf_merge():
    return render_template('pages/Organize/pdf_merge.html')

@page_bp.route('/pdf_split')
def pdf_split():
    return render_template('pages/Organize/pdf_split.html')

@page_bp.route('/remove_pages')
def remove_pages():
    return render_template('pages/Organize/remove_pages.html')

@page_bp.route('/extract_pages')
def extract_pages():
    return render_template('pages/Organize/extract_pages.html')

@page_bp.route('/organize_pdf')
def organize_pdf():
    return render_template('pages/Organize/organize_pdf.html')

# Routes for Optimize PDF pages
@page_bp.route('/pdf_compress')
def pdf_compress():
    return render_template('pages/Optimize/pdf_compress.html')

@page_bp.route('/repair_pdf')
def repair_pdf():
    return render_template('pages/Optimize/repair_pdf.html')

# Routes for Convert to PDF pages
@page_bp.route('/img_to_pdf')
def img_to_pdf():
    return render_template('pages/ConvertPDF/img_to_pdf.html')

@page_bp.route('/word_to_pdf')
def word_to_pdf():
    return render_template('pages/ConvertPDF/word_to_pdf.html')

# Routes for PDF to Convert pages
@page_bp.route('/pdf_to_word')
def pdf_to_word():
    return render_template('pages/PDFConvert/pdf_to_word.html')

# Routes for PowerPoint conversion
@page_bp.route('/ppt_to_pdf')
def ppt_to_pdf():
    return render_template('pages/ConvertPDF/ppt_to_pdf.html')

@page_bp.route('/pdf_to_ppt')
def pdf_to_ppt():
    return render_template('pages/PDFConvert/pdf_to_ppt.html')

# Routes for Excel conversion
@page_bp.route('/excel_to_pdf')
def excel_to_pdf():
    return render_template('pages/ConvertPDF/excel_to_pdf.html')

@page_bp.route('/pdf_to_excel')
def pdf_to_excel():
    return render_template('pages/PDFConvert/pdf_to_excel.html')

# Routes for HTML and Image conversion
@page_bp.route('/html_to_pdf')
def html_to_pdf():
    return render_template('pages/ConvertPDF/html_to_pdf.html')

@page_bp.route('/pdf_to_image')
def pdf_to_image():
    return render_template('pages/PDFConvert/pdf_to_img.html')

# Routes for PDF editing
@page_bp.route('/edit_pdf')
def edit_pdf():
    return render_template('pages/Edit/edit_pdf.html')

@page_bp.route('/rotate_pdf')
def rotate_pdf():
    return render_template('pages/Edit/rotate_pdf.html')

@page_bp.route('/add_page_number')
def add_page_number():
    return render_template('pages/Edit/add_page_number.html')

@page_bp.route('/add_watermark')
def add_watermark():
    return render_template('pages/Edit/add_watermark.html')

# Routes for PDF security
@page_bp.route('/protect_pdf')
def protect_pdf():
    return render_template('pages/Security/protect_pdf.html')

@page_bp.route('/unlock_pdf')
def unlock_pdf():
    return render_template('pages/Security/unlock_pdf.html')

@page_bp.route('/sign_pdf')
def sign_pdf():
    return render_template('pages/Security/sign_pdf.html')

@page_bp.route('/compare_pdf')
def compare_pdf():
    return render_template('pages/Security/compare_pdf.html')