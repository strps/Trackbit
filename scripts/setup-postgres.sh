#!/bin/bash
set -e

# Load .env variables from one level up
ENV_PATH="$(dirname "$0")/../.env"
if [ -f "$ENV_PATH" ]; then
  export $(grep -v '^#' "$ENV_PATH" | xargs)
else
  echo "❌ .env file not found at $ENV_PATH"
  exit 1
fi

# Validate required env vars
if [[ -z "$DB_USER" || -z "$DB_PASS" || -z "$DB_NAME" ]]; then
  echo "❌ DB_USER, DB_PASS, or DB_NAME not set in .env"
  exit 1
fi

# Create PostgreSQL user
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"

# Grant DB creation rights
sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;"

# Create database if it doesn't exist
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

# Create extension
sudo -u postgres psql -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS unaccent;"

echo "✅ PostgreSQL user '$DB_USER' and database '$DB_NAME' configured successfully."

