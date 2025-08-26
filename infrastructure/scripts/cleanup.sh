#!/bin/bash

# Modex Platform Cleanup Script
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${ENVIRONMENT:-dev}
FORCE=${FORCE:-false}

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Confirm destruction
confirm_cleanup() {
    if [ "$FORCE" != "true" ]; then
        warning "This will destroy the entire Modex platform infrastructure!"
        warning "Environment: $ENVIRONMENT"
        read -p "Are you sure you want to continue? (yes/no): " -r
        if [[ ! $REPLY =~ ^yes$ ]]; then
            log "Cleanup cancelled"
            exit 0
        fi
    fi
}

# Cleanup Kubernetes resources
cleanup_kubernetes() {
    log "Cleaning up Kubernetes resources..."
    
    # Delete Modex platform
    helm uninstall modex-platform -n modex-platform || true
    
    # Delete monitoring
    helm uninstall prometheus -n monitoring || true
    
    # Delete cert-manager
    helm uninstall cert-manager -n cert-manager || true
    
    # Delete ingress
    helm uninstall nginx-ingress -n ingress-nginx || true
    
    # Delete namespaces
    kubectl delete namespace modex-platform --ignore-not-found=true
    kubectl delete namespace monitoring --ignore-not-found=true
    kubectl delete namespace cert-manager --ignore-not-found=true
    kubectl delete namespace ingress-nginx --ignore-not-found=true
    
    success "Kubernetes cleanup completed"
}

# Cleanup infrastructure
cleanup_infrastructure() {
    log "Cleaning up infrastructure with Terraform..."
    
    cd infrastructure/terraform
    
    # Initialize Terraform
    terraform init
    
    # Destroy infrastructure
    terraform destroy -var="environment=$ENVIRONMENT" -auto-approve
    
    success "Infrastructure cleanup completed"
    cd - > /dev/null
}

# Main cleanup workflow
main() {
    log "Starting Modex Platform cleanup..."
    log "Environment: $ENVIRONMENT"
    
    confirm_cleanup
    cleanup_kubernetes
    cleanup_infrastructure
    
    success "🧹 Modex Platform cleanup completed!"
}

# Handle script arguments
case "${1:-all}" in
    "kubernetes")
        cleanup_kubernetes
        ;;
    "infrastructure")
        cleanup_infrastructure
        ;;
    "all"|*)
        main
        ;;
esac
