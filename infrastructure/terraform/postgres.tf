# Azure Database for PostgreSQL Flexible Server

# Private DNS Zone for PostgreSQL
resource "azurerm_private_dns_zone" "postgres" {
  name                = "modex-postgres.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.modex.name

  tags = var.common_tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres" {
  name                  = "postgres-vnet-link"
  resource_group_name   = azurerm_resource_group.modex.name
  private_dns_zone_name = azurerm_private_dns_zone.postgres.name
  virtual_network_id    = azurerm_virtual_network.modex.id

  tags = var.common_tags
}

# Random password for PostgreSQL admin
resource "random_password" "postgres_admin" {
  length  = 16
  special = true
}

# Store PostgreSQL admin password in Key Vault
resource "azurerm_key_vault_secret" "postgres_admin_password" {
  name         = "postgres-admin-password"
  value        = random_password.postgres_admin.result
  key_vault_id = azurerm_key_vault.modex.id

  depends_on = [azurerm_key_vault.modex]
}

# PostgreSQL Flexible Server
resource "azurerm_postgresql_flexible_server" "modex" {
  name                   = "${var.environment}-modex-postgres"
  resource_group_name    = azurerm_resource_group.modex.name
  location               = azurerm_resource_group.modex.location
  version                = "14"
  delegated_subnet_id    = azurerm_subnet.database.id
  private_dns_zone_id    = azurerm_private_dns_zone.postgres.id
  
  administrator_login    = var.postgres_admin_username
  administrator_password = var.postgres_admin_password != null ? var.postgres_admin_password : random_password.postgres_admin.result

  zone = "1"

  storage_mb   = 32768
  storage_tier = "P10"

  sku_name = var.postgres_sku

  backup_retention_days        = var.backup_retention_days
  geo_redundant_backup_enabled = false

  high_availability {
    mode                      = "ZoneRedundant"
    standby_availability_zone = "2"
  }

  maintenance_window {
    day_of_week  = 0
    start_hour   = 8
    start_minute = 0
  }

  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgres]

  tags = var.common_tags
}

# PostgreSQL Configuration
resource "azurerm_postgresql_flexible_server_configuration" "modex_config" {
  for_each = {
    "azure.extensions"                = "uuid-ossp"
    "log_checkpoints"                = "on"
    "log_connections"                = "on"
    "log_disconnections"             = "on"
    "log_duration"                   = "on"
    "connection_throttling"          = "on"
    "pg_qs.query_capture_mode"       = "TOP"
    "pgms_wait_sampling.query_capture_mode" = "ALL"
  }

  name      = each.key
  server_id = azurerm_postgresql_flexible_server.modex.id
  value     = each.value
}

# PostgreSQL Databases for each service
resource "azurerm_postgresql_flexible_server_database" "databases" {
  for_each = toset([
    "api_gateway",
    "course_management", 
    "enrollment",
    "assessment",
    "payment",
    "analytics"
  ])

  name      = each.key
  server_id = azurerm_postgresql_flexible_server.modex.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

# Firewall rules for PostgreSQL (if needed for management)
resource "azurerm_postgresql_flexible_server_firewall_rule" "modex" {
  for_each = { for idx, range in var.allowed_ip_ranges : idx => range }
  
  name             = "allow-range-${each.key}"
  server_id        = azurerm_postgresql_flexible_server.modex.id
  start_ip_address = split("/", each.value)[0]
  end_ip_address   = split("/", each.value)[0]
}