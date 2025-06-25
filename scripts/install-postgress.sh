#!/bin/bash
set -e

echo "1/5: Updating package list..."
sudo apt update

echo "2/5: Installing PostgreSQL from Debian repo..."
sudo apt install -y postgresql postgresql-contrib

#echo "3/5: (Optional) Add PGDG repo for latest versions..."
#sudo apt install -y postgresql-common
#sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh

#echo "4/5: Refreshing package list and installing again..."
#sudo apt update
#sudo apt install -y postgresql

echo "5/5: Enabling & starting service..."
sudo systemctl enable postgresql
sudo systemctl start postgresql

echo -n "PostgreSQL version installed: "
psql --version

