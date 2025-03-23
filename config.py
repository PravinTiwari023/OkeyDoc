import os

class Config:
    """Base configuration class"""
    DEBUG = False
    TESTING = False
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-key-for-development-only')
    STATIC_FOLDER = 'static'
    ALLOWED_EXTENSIONS = {'pdf'}

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    HOST = '0.0.0.0'
    PORT = 5000

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    # In production, you would set this to False and configure properly
    # Also consider setting a proper SECRET_KEY via environment variable

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    DEBUG = True

# Configuration dictionary to easily select environment
config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

# Helper function to get configuration
def get_config(config_name='default'):
    return config_by_name.get(config_name, config_by_name['default'])