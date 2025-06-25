#!/bin/bash
set -e

echo "Updating package list..."
sudo apt update

echo "Installing python3-pip..."
sudo apt install -y python3-pip

echo "Creating symbolic link for pip -> pip3..."
sudo ln -sf /usr/bin/pip3 /usr/bin/pip

echo "✅ pip installed and linked to pip3!"
pip --version

