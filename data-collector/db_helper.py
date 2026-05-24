"""
YouTube Niche Finder — Database Helper
========================================
Unifies SQLite and PostgreSQL operations, converting queries dynamically
and handling connection lifecycle safely.
"""

import os
import re
import urllib.parse
from dotenv import load_dotenv

# Load env variables
load_dotenv()

# We will try to import psycopg2. If not installed, we fallback to sqlite3.
try:
    import psycopg2
    import psycopg2.extras
    HAS_POSTGRES = True
except ImportError:
    HAS_POSTGRES = False

import sqlite3

class CursorWrapper:
    def __init__(self, cursor, is_postgres=False):
        self.cursor = cursor
        self.is_postgres = is_postgres

    def execute(self, query, params=None):
        if params is None:
            params = []
        
        # Convert tuple params to list to allow modifications
        if isinstance(params, tuple):
            params = list(params)
            
        if self.is_postgres:
            # 1. Translate SQLite '?' to Postgres '%s'
            query = query.replace('?', '%s')
            
            # 2. Translate SQLite functions if any
            # e.g., random() is same in both

            # 3. Convert 1/0 integers to True/False for Booleans in Postgres
            # To be safe, we map Python integers 1/0 to True/False if they are passed for boolean fields
            # Let's map standard boolean placeholders.
            processed_params = []
            for p in params:
                # If param is exactly 1 or 0, and we are on Postgres, let's be careful.
                # However, for safety, let's do boolean mapping explicitly in the script code.
                # Here we just pass the parameters as they are.
                processed_params.append(p)
            
            self.cursor.execute(query, processed_params)
        else:
            # SQLite query execution
            self.cursor.execute(query, params)
        return self

    def fetchone(self):
        return self.cursor.fetchone()

    def fetchall(self):
        return self.cursor.fetchall()

    def rowcount(self):
        return self.cursor.rowcount

    def close(self):
        self.cursor.close()

class ConnectionWrapper:
    def __init__(self, db_url=None):
        self.is_postgres = False
        self.conn = None
        
        # 1. Determine connection type
        if not db_url:
            db_url = os.getenv("DATABASE_URL", "file:../prisma/dev.db")
            
        if db_url.startswith("postgresql://") or db_url.startswith("postgres://"):
            if not HAS_POSTGRES:
                raise ImportError("PostgreSQL DATABASE_URL provided but 'psycopg2' is not installed! Run: pip install psycopg2-binary")
            self.is_postgres = True
            
            # Parse the DB URL to handle potential special character issues in password
            # psycopg2.connect natively handles postgresql:// urls perfectly!
            self.conn = psycopg2.connect(db_url)
        else:
            # SQLite fallback
            self.is_postgres = False
            # Clean url if it starts with file:
            lite_path = db_url
            if lite_path.startswith("file:"):
                lite_path = lite_path.replace("file:", "")
            # Ensure folder exists
            os.makedirs(os.path.dirname(os.path.abspath(lite_path)), exist_ok=True)
            self.conn = sqlite3.connect(lite_path)
            
    def execute(self, query, params=None):
        cursor = self.cursor()
        cursor.execute(query, params)
        return cursor

    def cursor(self):
        return CursorWrapper(self.conn.cursor(), self.is_postgres)

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        self.conn.close()

def get_connection(db_url=None):
    """
    Returns a unified ConnectionWrapper object.
    Automatically detects whether to use Postgres or SQLite from environment.
    """
    return ConnectionWrapper(db_url)
