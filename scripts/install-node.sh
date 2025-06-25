#!/bin/bash
set -e

# 1. Update system packages
echo "Updating package list..."
sudo apt update

# 2. Download the setup script:
echo "Download node setup script"
sudo curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh

# 3. Run the setup script with sudo
echo "Run the setup script with sudo"
sudo bash nodesource_setup.sh

# 4. Install Node.js:
echo "Installing Node.js"
sudo apt-get install -y nodejs

# x. Removing setup script
echo "Removing setup script"
rm nodesource_setup.sh -f

# 5. Verify installation
echo -n "Node.js version: " && node -v
echo -n "npm version:     " && npm -v

