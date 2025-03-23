class PDFFile:
    """Model representing a PDF file and its operations"""
    
    def __init__(self, filename=None, file_bytes=None):
        self.filename = filename
        self.file_bytes = file_bytes
        self.size = len(file_bytes) if file_bytes else 0
        self.page_count = None
    
    def is_valid(self):
        """Check if the PDF file is valid"""
        if not self.filename or not self.file_bytes:
            return False
        
        # Check file extension
        return '.' in self.filename and \
               self.filename.rsplit('.', 1)[1].lower() == 'pdf'
    
    def get_size_in_kb(self):
        """Get file size in KB"""
        return self.size / 1024
    
    def get_size_in_mb(self):
        """Get file size in MB"""
        return self.size / (1024 * 1024)
    
    @staticmethod
    def allowed_file(filename):
        """Check if file has an allowed extension"""
        return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'pdf'