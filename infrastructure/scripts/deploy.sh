#!/bin/bash

# Modex Platform Deployment Script
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${ENVIRONMENT:-dev}
RESOURCE_GROUP=""
AKS_CLUSTER=""
SUBSCRIPTION_ID=""

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

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if required tools are installed
    if ! command -v az &> /dev/null; then
        error "Azure CLI is not installed"
    fi
    
    if ! command -v terraform &> /dev/null; then
        error "Terraform is not installed"
    fi
    
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed"
    fi
    
    if ! command -v helm &> /dev/null; then
        error "Helm is not installed"
    fi
    
    success "Prerequisites check completed"
}

# Azure login and subscription selection
setup_azure() {
    log "Setting up Azure connection..."
    
    # Check if logged in
    if ! az account show &> /dev/null; then
        log "Please log in to Azure..."
        az login
    fi
    
    # Set subscription if provided
    if [ -n "$SUBSCRIPTION_ID" ]; then
        az account set --subscription "$SUBSCRIPTION_ID"
    fi
    
    success "Azure setup completed"
}

# Deploy infrastructure with Terraform
deploy_infrastructure() {
    log "Deploying infrastructure with Terraform..."
    
    cd infrastructure/terraform
    
    # Initialize Terraform
    terraform init
    
    # Validate configuration
    terraform validate
    
    # Plan deployment
    terraform plan -var="environment=$ENVIRONMENT" -out=tfplan
    
    # Apply deployment
    terraform apply -auto-approve tfplan
    
    # Get outputs
    RESOURCE_GROUP=$(terraform output -raw resource_group_name)
    AKS_CLUSTER=$(terraform output -raw aks_cluster_name)
    
    success "Infrastructure deployment completed"
    cd - > /dev/null
}

# Configure Kubernetes access
setup_kubernetes() {
    log "Setting up Kubernetes access..."
    
    # Get AKS credentials
    az aks get-credentials --resource-group "$RESOURCE_GROUP" --name "$AKS_CLUSTER" --overwrite-existing
    
    # Verify connection
    kubectl cluster-info
    
    success "Kubernetes setup completed"
}

# Deploy applications with Helm
deploy_applications() {
    log "Deploying applications with Helm..."
    
    cd infrastructure/helm
    
    # Add required Helm repositories
    helm repo add bitnami https://charts.bitnami.com/bitnami
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo add jetstack https://charts.jetstack.io
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    # Create namespace
    kubectl create namespace modex-platform --dry-run=client -o yaml | kubectl apply -f -
    
    # Install NGINX Ingress
    helm upgrade --install nginx-ingress ingress-nginx/ingress-nginx \
        --namespace ingress-nginx \
        --create-namespace \
        --set controller.service.type=LoadBalancer \
        --wait
    
    # Install cert-manager
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace cert-manager \
        --create-namespace \
        --version v1.13.0 \
        --set installCRDs=true \
        --wait
    
    # Install monitoring stack
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace \
        --set grafana.adminPassword=admin123 \
        --wait
    
    # Get Terraform outputs for configuration
    POSTGRES_HOST=$(cd ../terraform && terraform output -raw postgres_server_fqdn)
    REDIS_HOST=$(cd ../terraform && terraform output -raw redis_hostname)
    ACR_LOGIN_SERVER=$(cd ../terraform && terraform output -raw container_registry_login_server)
    
    # Install Modex Platform
    helm upgrade --install modex-platform ./platform \
        --namespace modex-platform \
        --set global.imageRegistry="$ACR_LOGIN_SERVER" \
        --set postgresql.external.host="$POSTGRES_HOST" \
        --set redis.external.host="$REDIS_HOST" \
        --set global.environment="$ENVIRONMENT" \
        --wait --timeout=10m
    
    success "Applications deployment completed"
    cd - > /dev/null
}

# Configure monitoring
setup_monitoring() {
    log "Setting up monitoring and alerting..."
    
    # Apply Grafana dashboard
    kubectl create configmap grafana-dashboards \
        --from-file=infrastructure/monitoring/grafana-dashboards.json \
        --namespace=monitoring \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Get monitoring endpoints
    GRAFANA_IP=$(kubectl get svc -n monitoring prometheus-grafana -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    PROMETHEUS_IP=$(kubectl get svc -n monitoring prometheus-kube-prometheus-prometheus -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    
    log "Monitoring endpoints:"
    log "Grafana: http://$GRAFANA_IP (admin/admin123)"
    log "Prometheus: http://$PROMETHEUS_IP:9090"
    
    success "Monitoring setup completed"
}

# Run Ansible playbook
configure_services() {
    log "Running Ansible configuration..."
    
    cd infrastructure/ansible
    
    # Install required Ansible collections
    ansible-galaxy collection install kubernetes.core
    ansible-galaxy collection install azure.azcollection
    
    # Run playbook
    ansible-playbook -i inventory playbooks/configure-nodes.yml \
        -e resource_group_name="$RESOURCE_GROUP" \
        -e aks_cluster_name="$AKS_CLUSTER" \
        -e azure_location="East US"
    
    success "Ansible configuration completed"
    cd - > /dev/null
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    # Check pod status
    kubectl get pods -n modex-platform
    
    # Check services
    kubectl get services -n modex-platform
    
    # Check ingress
    kubectl get ingress -n modex-platform
    
    # Test API Gateway health
    API_GATEWAY_IP=$(kubectl get svc -n modex-platform api-gateway-service -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    if [ -n "$API_GATEWAY_IP" ]; then
        log "Testing API Gateway health endpoint..."
        if curl -f "http://$API_GATEWAY_IP:3000/health" > /dev/null 2>&1; then
            success "API Gateway health check passed"
        else
            warning "API Gateway health check failed"
        fi
    fi
    
    success "Deployment verification completed"
}

# Main deployment workflow
main() {
    log "Starting Modex Platform deployment..."
    log "Environment: $ENVIRONMENT"
    
    check_prerequisites
    setup_azure
    deploy_infrastructure
    setup_kubernetes
    deploy_applications
    setup_monitoring
    configure_services
    verify_deployment
    
    success "🎉 Modex Platform deployment completed successfully!"
    
    # Display access information
    log "Access Information:"
    log "API Gateway: kubectl port-forward -n modex-platform svc/api-gateway-service 3000:3000"
    log "Grafana: kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80"
    log "Kubernetes Dashboard: kubectl proxy"
}

# Handle script arguments
case "${1:-deploy}" in
    "infrastructure")
        check_prerequisites
        setup_azure
        deploy_infrastructure
        ;;
    "applications")
        setup_kubernetes
        deploy_applications
        ;;
    "monitoring")
        setup_monitoring
        ;;
    "verify")
        verify_deployment
        ;;
    "deploy"|*)
        main
        ;;
esac
