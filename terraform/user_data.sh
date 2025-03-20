#!/bin/bash -xe
# Set up logging
LOG_FILE="/var/log/user-data.log"
touch $LOG_FILE
chmod 666 $LOG_FILE
exec 1>>$LOG_FILE 2>&1

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$${2:-INFO}] $${1}"
}

log_section() {
    echo ""
    echo "================================================================"
    log "$1" "SECTION"
    echo "================================================================"
}

log_section "Starting Instance Configuration"
log "Script initiated with user data execution"

# System Updates
log_section "System Updates"
log "Updating system packages"
yum update -y

# Configure locale
log "Configuring system locale"
localedef -i en_US -f UTF-8 en_US.UTF-8
echo 'LANG=en_US.UTF-8' > /etc/locale.conf
echo 'LC_CTYPE=en_US.UTF-8' >> /etc/locale.conf
source /etc/locale.conf

log "System update and locale configuration completed" "SUCCESS"


# Docker Installation
log_section "Docker Setup"
log "Installing Docker"
amazon-linux-extras install docker -y
log "Starting Docker service"
systemctl start docker
systemctl enable docker
log "Adding ec2-user to docker group"
usermod -a -G docker ec2-user
log "Docker installation completed" "SUCCESS"

# Git Installation
log_section "Git Setup"
log "Installing Git"
yum install git -y
log "Git installation completed" "SUCCESS"

# Set up SSH directory and keys
log "Setting up SSH configuration"
mkdir -p /home/ec2-user/.ssh
chmod 700 /home/ec2-user/.ssh

# Add GitHub to known hosts
log "Adding GitHub to known hosts"
ssh-keyscan -t rsa github.com >> /home/ec2-user/.ssh/known_hosts
chmod 644 /home/ec2-user/.ssh/known_hosts

# Copy the SSH key
log "Setting up deployment SSH key"
cat > /home/ec2-user/.ssh/id_rsa << 'EOL'
${file("~/.ssh/id_rsa")}
EOL
chmod 600 /home/ec2-user/.ssh/id_rsa

cat > /home/ec2-user/.ssh/id_rsa.pub << 'EOL'
${file("~/.ssh/id_rsa.pub")}
EOL
chmod 644 /home/ec2-user/.ssh/id_rsa.pub

# Set proper ownership
chown -R ec2-user:ec2-user /home/ec2-user/.ssh

# Test SSH connection to GitHub
log "Testing GitHub SSH connection"
sudo -u ec2-user ssh -T -o StrictHostKeyChecking=no git@github.com || true

# Install Docker Compose
log "Installing Docker Compose"
curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-Linux-x86_64" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Verify Docker Compose installation
docker-compose version


# Create app directory and set permissions
cd /home/ec2-user
sudo -u ec2-user git clone https://github.com/voyzme/web-client.git app
chown -R ec2-user:ec2-user /home/ec2-user/app
cd /home/ec2-user/app

# Fix Git safe directory issue
sudo -u ec2-user git config --global --add safe.directory /home/ec2-user/app

sudo -u ec2-user git checkout vd-development

# copy ssh keys for docker
mkdir -p /home/ec2-user/app/ssh-keys/
# copy ssh keys for docker
mkdir -p /home/ec2-user/app/ssh-keys/
cp /home/ec2-user/.ssh/id_rsa /home/ec2-user/app/ssh-keys/
cp /home/ec2-user/.ssh/known_hosts /home/ec2-user/app/ssh-keys/

# copy certificates for nginx
mkdir -p /home/ec2-user/app/certificates
cat > /home/ec2-user/app/certificates/ca_bundle.crt << 'EOL'
${file("~/web-client/certificates/ca_bundle.crt")}
EOL
chmod 644 /home/ec2-user/app/certificates/ca_bundle.crt

cat > /home/ec2-user/app/certificates/certificate.crt << 'EOL'
${file("~/web-client/certificates/certificate.crt")}
EOL
chmod 644 /home/ec2-user/app/certificates/certificate.crt

cat > /home/ec2-user/app/certificates/private.key << 'EOL'
${file("~/web-client/certificates/private.key")}
EOL
chmod 644 /home/ec2-user/app/certificates/private.key

# run docker compose 
docker compose up -d
