# Modex Platform - Azure Infrastructure
terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~>3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~>3.1"
    }
  }
  
  backend "azurerm" {
    resource_group_name  = "modex-terraform-state"
    storage_account_name = "modexterraformstate"
    container_name       = "terraform-state"
    key                  = "modex.terraform.tfstate"
  }
}

# Configure the Microsoft Azure Provider
provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
  }
}

# Random suffix for unique naming
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# Resource Group
resource "azurerm_resource_group" "modex" {
  name     = "${var.environment}-modex-rg-${random_string.suffix.result}"
  location = var.location

  tags = var.common_tags
}

# Virtual Network and Subnets
resource "azurerm_virtual_network" "modex" {
  name                = "${var.environment}-modex-vnet"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.modex.location
  resource_group_name = azurerm_resource_group.modex.name

  tags = var.common_tags
}

resource "azurerm_subnet" "aks" {
  name                 = "${var.environment}-aks-subnet"
  resource_group_name  = azurerm_resource_group.modex.name
  virtual_network_name = azurerm_virtual_network.modex.name
  address_prefixes     = ["10.0.1.0/24"]
}

resource "azurerm_subnet" "database" {
  name                 = "${var.environment}-db-subnet"
  resource_group_name  = azurerm_resource_group.modex.name
  virtual_network_name = azurerm_virtual_network.modex.name
  address_prefixes     = ["10.0.2.0/24"]
  
  delegation {
    name = "postgresql"
    service_delegation {
      name = "Microsoft.DBforPostgreSQL/flexibleServers"
    }
  }
}

resource "azurerm_subnet" "redis" {
  name                 = "${var.environment}-redis-subnet"
  resource_group_name  = azurerm_resource_group.modex.name
  virtual_network_name = azurerm_virtual_network.modex.name
  address_prefixes     = ["10.0.3.0/24"]
}

# Network Security Group
resource "azurerm_network_security_group" "modex" {
  name                = "${var.environment}-modex-nsg"
  location            = azurerm_resource_group.modex.location
  resource_group_name = azurerm_resource_group.modex.name

  security_rule {
    name                       = "AllowHTTPS"
    priority                   = 1001
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "AllowHTTP"
    priority                   = 1002
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = var.common_tags
}

# Associate Network Security Group to Subnet
resource "azurerm_subnet_network_security_group_association" "aks" {
  subnet_id                 = azurerm_subnet.aks.id
  network_security_group_id = azurerm_network_security_group.modex.id
}