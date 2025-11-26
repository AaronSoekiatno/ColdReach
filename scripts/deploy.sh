#!/bin/bash

# ColdStart Deployment Script
# Automates common deployment tasks

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
    log_success "Docker is running"
}

# Check if .env file exists
check_env() {
    if [ ! -f .env ]; then
        log_warning ".env file not found. Creating from .env.example..."
        if [ -f .env.example ]; then
            cp .env.example .env
            log_warning "Please edit .env and add your GEMINI_API_KEY"
            exit 1
        else
            log_error ".env.example not found"
            exit 1
        fi
    fi

    # Check if GEMINI_API_KEY is set
    if ! grep -q "GEMINI_API_KEY=.*[^[:space:]]" .env; then
        log_error "GEMINI_API_KEY not set in .env file"
        exit 1
    fi

    log_success ".env file configured"
}

# Build Docker images
build() {
    log_info "Building Docker images..."
    docker compose build --no-cache
    log_success "Docker images built"
}

# Start services
start() {
    log_info "Starting services..."
    docker compose up -d

    log_info "Waiting for services to be healthy..."
    sleep 10

    # Check if services are running
    if docker compose ps | grep -q "Up"; then
        log_success "Services started successfully"
        log_info "Web app: http://localhost:3000"
        log_info "Helix DB: http://localhost:6969"
    else
        log_error "Services failed to start. Check logs with: docker compose logs"
        exit 1
    fi
}

# Stop services
stop() {
    log_info "Stopping services..."
    docker compose down
    log_success "Services stopped"
}

# Restart services
restart() {
    log_info "Restarting services..."
    docker compose restart
    log_success "Services restarted"
}

# View logs
logs() {
    docker compose logs -f "$@"
}

# Run CSV ingestion
ingest() {
    log_info "Running CSV ingestion..."
    docker exec -it coldstart-web npm run ingest
    log_success "Ingestion complete"
}

# Deploy (full update)
deploy() {
    log_info "Starting deployment..."

    # Pull latest code
    if [ -d .git ]; then
        log_info "Pulling latest code from Git..."
        git pull origin main
    fi

    # Build and restart
    log_info "Building and restarting services..."
    docker compose up -d --build

    # Wait for health check
    log_info "Waiting for services to be healthy..."
    sleep 15

    log_success "Deployment complete!"
}

# Backup Helix data
backup() {
    BACKUP_FILE="helix-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    log_info "Creating backup: $BACKUP_FILE"

    docker run --rm \
        -v coldstart-helix-data:/data \
        -v $(pwd):/backup \
        alpine tar czf /backup/$BACKUP_FILE -C /data .

    log_success "Backup created: $BACKUP_FILE"
}

# Restore Helix data
restore() {
    if [ -z "$1" ]; then
        log_error "Usage: $0 restore <backup-file.tar.gz>"
        exit 1
    fi

    if [ ! -f "$1" ]; then
        log_error "Backup file not found: $1"
        exit 1
    fi

    log_warning "This will overwrite all current Helix data!"
    read -p "Are you sure? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        log_info "Restore cancelled"
        exit 0
    fi

    log_info "Restoring from: $1"

    # Stop Helix to avoid data corruption
    docker compose stop helix

    # Restore data
    docker run --rm \
        -v coldstart-helix-data:/data \
        -v $(pwd):/backup \
        alpine sh -c "cd /data && tar xzf /backup/$1"

    # Restart Helix
    docker compose start helix

    log_success "Restore complete"
}

# Clean up (remove containers and volumes)
clean() {
    log_warning "This will remove all containers and data!"
    read -p "Are you sure? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        log_info "Clean cancelled"
        exit 0
    fi

    log_info "Removing containers and volumes..."
    docker compose down -v
    log_success "Cleanup complete"
}

# Show status
status() {
    log_info "Service Status:"
    docker compose ps

    echo ""
    log_info "Resource Usage:"
    docker stats coldstart-web coldstart-helix --no-stream
}

# Show help
show_help() {
    cat << EOF
ColdStart Deployment Script

Usage: $0 <command> [options]

Commands:
    start           Start all services
    stop            Stop all services
    restart         Restart all services
    build           Build Docker images
    deploy          Full deployment (pull, build, restart)
    logs [service]  View logs (optional: specify web or helix)
    ingest          Run CSV ingestion script
    backup          Backup Helix database
    restore <file>  Restore Helix database from backup
    status          Show service status and resource usage
    clean           Remove all containers and volumes (CAUTION)
    help            Show this help message

Examples:
    $0 start                    # Start all services
    $0 logs                     # View all logs
    $0 logs web                 # View only web service logs
    $0 deploy                   # Deploy updates from Git
    $0 backup                   # Create a backup
    $0 restore backup.tar.gz    # Restore from backup

EOF
}

# Main script
main() {
    # Check prerequisites
    check_docker

    # Parse command
    COMMAND="${1:-help}"

    case "$COMMAND" in
        start)
            check_env
            start
            ;;
        stop)
            stop
            ;;
        restart)
            restart
            ;;
        build)
            check_env
            build
            ;;
        deploy)
            check_env
            deploy
            ;;
        logs)
            shift
            logs "$@"
            ;;
        ingest)
            ingest
            ;;
        backup)
            backup
            ;;
        restore)
            restore "$2"
            ;;
        status)
            status
            ;;
        clean)
            clean
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
