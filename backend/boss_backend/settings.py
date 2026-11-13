import os
import sys
from pathlib import Path

from corsheaders.defaults import default_headers
import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env file in local development
load_dotenv(BASE_DIR / '.env')

DEBUG = os.getenv('DJANGO_DEBUG', 'True').strip().lower() in ('1', 'true', 'yes')
COLLECTSTATIC_MODE = len(sys.argv) > 1 and 'collectstatic' in sys.argv
IS_TEST_RUN = len(sys.argv) > 1 and 'test' in sys.argv

INSECURE_DEFAULT_KEY = 'django-insecure-boss-pickleball-arena-secret-key-2026'
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', '').strip()
if not SECRET_KEY:
    if DEBUG or COLLECTSTATIC_MODE:
        SECRET_KEY = INSECURE_DEFAULT_KEY
    else:
        raise ImproperlyConfigured('DJANGO_SECRET_KEY environment variable is required when DJANGO_DEBUG=False.')
elif not DEBUG and not COLLECTSTATIC_MODE and SECRET_KEY == INSECURE_DEFAULT_KEY:
    raise ImproperlyConfigured('DJANGO_SECRET_KEY must not use the insecure default value in production.')

BACKEND_SERVICE_SECRET = os.getenv('BACKEND_SERVICE_SECRET', '').strip()
if not DEBUG and not COLLECTSTATIC_MODE and not BACKEND_SERVICE_SECRET:
    raise ImproperlyConfigured('BACKEND_SERVICE_SECRET environment variable is required when DJANGO_DEBUG=False.')


def _split_csv_env(var_name: str, default: str = '') -> list[str]:
    raw = os.getenv(var_name, default)
    return [item.strip() for item in raw.split(',') if item.strip()]


ALLOWED_HOSTS = _split_csv_env(
    'DJANGO_ALLOWED_HOSTS',
    'localhost,127.0.0.1,testserver' if DEBUG else '',
)
render_hostname = os.getenv('RENDER_EXTERNAL_HOSTNAME', '').strip()
if render_hostname and render_hostname not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(render_hostname)

if not DEBUG and not COLLECTSTATIC_MODE:
    if not ALLOWED_HOSTS or '*' in ALLOWED_HOSTS:
        raise ImproperlyConfigured(
            'DJANGO_ALLOWED_HOSTS must list explicit hostnames/domains (never "*") when DJANGO_DEBUG=False.'
        )

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party packages
    'corsheaders',
    'rest_framework',

    # Arena core app
    'arena',
]

try:
    import storages  # noqa: F401
    INSTALLED_APPS.append('storages')
except ImportError:
    pass

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'boss_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'boss_backend.wsgi.application'

AUTH_USER_MODEL = 'arena.User'

# Database Configuration:
# Production (DJANGO_DEBUG=False) strictly requires DATABASE_URL or POSTGRES_DB (PostgreSQL).
# SQLite is permitted ONLY in local DEBUG=True development / test runs.
DATABASE_URL = os.getenv('DATABASE_URL', '').strip()
POSTGRES_DB = os.getenv('POSTGRES_DB', '').strip()

if DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
elif POSTGRES_DB:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': POSTGRES_DB,
            'USER': os.getenv('POSTGRES_USER', 'postgres'),
            'PASSWORD': os.getenv('POSTGRES_PASSWORD', 'postgres'),
            'HOST': os.getenv('POSTGRES_HOST', 'localhost'),
            'PORT': os.getenv('POSTGRES_PORT', '5432'),
        }
    }
elif DEBUG or COLLECTSTATIC_MODE or IS_TEST_RUN:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
else:
    raise ImproperlyConfigured(
        'DATABASE_URL (PostgreSQL) is required when DJANGO_DEBUG=False. SQLite fallback is disabled in production.'
    )

if not DEBUG and not COLLECTSTATIC_MODE and DATABASES['default'].get('ENGINE') == 'django.db.backends.sqlite3':
    raise ImproperlyConfigured('SQLite database backend cannot be used in production (DJANGO_DEBUG=False).')

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
]

# Internationalization — Boss Pickleball Gondal operates strictly on Asia/Kolkata (IST)
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# Static and Media Files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
SERVE_LOCAL_MEDIA = os.getenv('SERVE_LOCAL_MEDIA', 'True' if DEBUG else 'False').strip().lower() in ('1', 'true', 'yes')

# Durable Media Cloud Storage (AWS S3, Cloudflare R2, MinIO, or Supabase Storage)
AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME', '').strip()
if AWS_STORAGE_BUCKET_NAME:
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID', '').strip()
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY', '').strip()
    AWS_S3_REGION_NAME = os.getenv('AWS_S3_REGION_NAME', 'auto').strip()
    AWS_S3_ENDPOINT_URL = os.getenv('AWS_S3_ENDPOINT_URL', '').strip() or None
    AWS_S3_CUSTOM_DOMAIN = os.getenv('AWS_S3_CUSTOM_DOMAIN', '').strip() or None
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = False
    AWS_S3_FILE_OVERWRITE = False

    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'

DATA_UPLOAD_MAX_MEMORY_SIZE = 20 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 20 * 1024 * 1024

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'arena.auth.ServiceAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
}

# CORS & CSRF Configuration (Server-to-server BFF calls bypass browser CORS, strict origins enforced for browsers)
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True

_cors_origins = _split_csv_env('CORS_ALLOWED_ORIGINS')
_frontend_origin = os.getenv('FRONTEND_ORIGIN', '').strip()
if _frontend_origin and _frontend_origin not in _cors_origins:
    _cors_origins.append(_frontend_origin)
CORS_ALLOWED_ORIGINS = _cors_origins

if DEBUG:
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r"^http://localhost:[0-9]+$",
        r"^http://127\.0\.0\.1:[0-9]+$",
    ]
elif os.getenv('ALLOW_VERCEL_PREVIEW_ORIGINS', 'False').strip().lower() in ('1', 'true', 'yes'):
    CORS_ALLOWED_ORIGIN_REGEXES = [r"^https://[a-zA-Z0-9-]+\.vercel\.app$"]
else:
    CORS_ALLOWED_ORIGIN_REGEXES = []

CORS_ALLOW_HEADERS = list(default_headers) + [
    'x-boss-timestamp',
    'x-boss-service-signature',
    'x-boss-actor-id',
    'x-boss-actor-role',
    'x-boss-actor-name',
    'x-boss-actor-email',
    'x-boss-actor-phone',
]

CSRF_TRUSTED_ORIGINS = _split_csv_env('CSRF_TRUSTED_ORIGINS')
for origin in CORS_ALLOWED_ORIGINS:
    if origin.startswith(('http://', 'https://')) and origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(origin)
if render_hostname:
    render_origin = f"https://{render_hostname}"
    if render_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(render_origin)

# TLS & Reverse Proxy Security in Production
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    USE_X_FORWARDED_HOST = True
    SECURE_SSL_REDIRECT = os.getenv('DJANGO_SECURE_SSL_REDIRECT', 'True').strip().lower() in ('1', 'true', 'yes')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'

# Redis & Celery Configuration (Coordination / Async Tasks Only — PostgreSQL holds booking & revenue truth)
REDIS_URL = os.getenv('REDIS_URL', '').strip()

if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
            'TIMEOUT': 60,
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }

_celery_default = REDIS_URL or 'redis://localhost:6379/0'
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', _celery_default)
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', _celery_default)
CELERY_ACCEPT_CONTENT = ['application/json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_RESULT_EXPIRES = 3600
CELERY_TIMEZONE = TIME_ZONE
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_BROKER_TRANSPORT_OPTIONS = {
    'socket_connect_timeout': 3,
    'socket_timeout': 3,
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': '%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'standard',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}
