from flask import Flask
from flask_cors import CORS
import logging
from config import get_config
from routes.page_routes import page_bp
from routes.api_routes import api_bp

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def create_app(config_name='development'):
    """Application factory function"""
    # Initialize app with configuration
    app = Flask(__name__)
    app.config.from_object(get_config(config_name))
    
    # Enable CORS
    CORS(app)  # Enable CORS for all routes (restrict in production if needed)
    
    # Register blueprints
    app.register_blueprint(page_bp)
    app.register_blueprint(api_bp)
    
    # Configure static folder
    app.static_folder = 'static'
    
    return app

# Create app instance
app = create_app()

# All routes have been moved to blueprints in the routes directory

if __name__ == '__main__':
    app.run(
        debug=app.config['DEBUG'],
        host=app.config.get('HOST', '0.0.0.0'),
        port=app.config.get('PORT', 5000)
    )