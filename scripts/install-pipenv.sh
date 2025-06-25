#!/usr/bin/env bash
set -e

# Ensure pip is installed
#sudo apt update
#sudo apt install -y python3-pip

# Install pipenv globally
pip3 install --user pipenv

# Add user base binary path to shell if not already
if ! echo $PATH | grep -q "$(python3 -m site --user-base)/bin"; then
  echo -e '\n# Add pipenv to PATH' >> ~/.bashrc
  echo 'export PATH="$(python3 -m site --user-base)/bin:$PATH"' >> ~/.bashrc
fi

echo "✅ pipenv installed. Restart your terminal or run:"
echo 'export PATH="$(python3 -m site --user-base)/bin:$PATH"'

