# Azure Kubernetes Service (AKS) Configuration

# Key Vault for secrets
resource "azurerm_key_vault" "modex" {
  name                       = "${var.environment}-modex-kv-${random_string.suffix.result}"
  location                   = azurerm_resource_group.modex.location
  resource_group_name        = azurerm_resource_group.modex.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 7

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    key_permissions = [
      "Create", "Get", "List", "Update", "Delete"
    ]

    secret_permissions = [
      "Get", "List", "Set", "Delete"
    ]
  }

  tags = var.common_tags
}

# Log Analytics Workspace for AKS monitoring
resource "azurerm_log_analytics_workspace" "modex" {
  name                = "${var.environment}-modex-logs"
  location            = azurerm_resource_group.modex.location
  resource_group_name = azurerm_resource_group.modex.name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = var.common_tags
}

# AKS Cluster
resource "azurerm_kubernetes_cluster" "modex" {
  name                = "${var.environment}-modex-aks"
  location            = azurerm_resource_group.modex.location
  resource_group_name = azurerm_resource_group.modex.name
  dns_prefix          = "${var.environment}-modex-aks"
  kubernetes_version  = "1.27.7"

  default_node_pool {
    name               = "system"
    node_count         = var.aks_node_count
    vm_size            = var.aks_node_size
    vnet_subnet_id     = azurerm_subnet.aks.id
    type               = "VirtualMachineScaleSets"
    auto_scaling_enabled = true
    min_count          = 1
    max_count          = 10
    
    upgrade_settings {
      max_surge = "10%"
    }
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin    = "azure"
    load_balancer_sku = "standard"
  }

  oms_agent {
    log_analytics_workspace_id = azurerm_log_analytics_workspace.modex.id
  }

  azure_policy_enabled = true

  tags = var.common_tags
}

# User Node Pool for applications
resource "azurerm_kubernetes_cluster_node_pool" "user" {
  name                  = "user"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.modex.id
  vm_size               = var.aks_node_size
  node_count            = 2
  vnet_subnet_id        = azurerm_subnet.aks.id
  
  auto_scaling_enabled = true
  min_count           = 1
  max_count           = 5

  upgrade_settings {
    max_surge = "10%"
  }

  node_taints = ["workload=user:NoSchedule"]

  tags = var.common_tags
}

# Container Registry
resource "azurerm_container_registry" "modex" {
  name                = "${var.environment}modexacr${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.modex.name
  location            = azurerm_resource_group.modex.location
  sku                 = "Standard"
  admin_enabled       = false

  tags = var.common_tags
}

# Grant AKS cluster access to ACR
resource "azurerm_role_assignment" "aks_acr" {
  principal_id                     = azurerm_kubernetes_cluster.modex.kubelet_identity[0].object_id
  role_definition_name             = "AcrPull"
  scope                           = azurerm_container_registry.modex.id
  skip_service_principal_aad_check = true
}

# Data source for current Azure configuration
data "azurerm_client_config" "current" {}

# Application Insights for monitoring
resource "azurerm_application_insights" "modex" {
  name                = "${var.environment}-modex-insights"
  location            = azurerm_resource_group.modex.location
  resource_group_name = azurerm_resource_group.modex.name
  workspace_id        = azurerm_log_analytics_workspace.modex.id
  application_type    = "web"

  tags = var.common_tags
}