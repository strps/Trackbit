#!/usr/bin/env bash
set -e

# Install required dependencies
sudo apt update
sudo apt install -y curl git make build-essential libssl-dev zlib1g-dev \
libbz2-dev libreadline-dev libsqlite3-dev wget llvm \
libncursesw5-dev xz-utils tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev

#Automatic installer (Recommended)
curl -fsSL https://pyenv.run | bash

# Add pyenv to shell config
echo -e '\n# Pyenv config' >> ~/.bashrc
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc
echo 'export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(pyenv init --path)"' >> ~/.bashrc
echo 'eval "$(pyenv init -)"' >> ~/.bashrc

echo "✅ pyenv installed successfully."
echo "ℹ️ Restart your terminal or run the following to activate it now:"
echo 'export PYENV_ROOT="$HOME/.pyenv" && export PATH="$PYENV_ROOT/bin:$PATH" && eval "$(pyenv init --path)" && eval "$(pyenv init -)"'
