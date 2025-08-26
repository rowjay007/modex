# Azure Cache for Redis

# Private DNS Zone for Redis
resource "azurerm_private_dns_zone" "redis" {
  name                = "privatelink.redis.cache.windows.net"
  resource_group_name = azurerm_resource_group.modex.name

  tags = var.common_tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "redis" {
  name                  = "redis-vnet-link"
  resource_group_name   = azurerm_resource_group.modex.name
  private_dns_zone_name = azurerm_private_dns_zone.redis.name
  virtual_network_id    = azurerm_virtual_network.modex.id
  registration_enabled  = false

  tags = var.common_tags
}

# Redis Cache
resource "azurerm_redis_cache" "modex" {
  name                = "${var.environment}-modex-redis-${random_string.suffix.result}"
  location            = azurerm_resource_group.modex.location
  resource_group_name = azurerm_resource_group.modex.name
  capacity            = var.redis_capacity
  family              = var.redis_family
  sku_name            = var.redis_sku_name
  non_ssl_port_enabled = false
  minimum_tls_version  = "1.2"
  subnet_id            = azurerm_subnet.redis.id
  private_static_ip_address = "10.0.3.5"

  redis_configuration {
    maxmemory_reserved    = 30
    maxmemory_delta       = 30
    maxmemory_policy      = "allkeys-lru"
    notify_keyspace_events = ""
  }

  patch_schedule {
    day_of_week    = "Sunday"
    start_hour_utc = 2
  }

  tags = var.common_tags
}

# Private Endpoint for Redis
resource "azurerm_private_endpoint" "redis" {
  name                = "${var.environment}-modex-redis-pe"
  location            = azurerm_resource_group.modex.location
  resource_group_name = azurerm_resource_group.modex.name
  subnet_id           = azurerm_subnet.redis.id

  private_service_connection {
    name                           = "redis-private-connection"
    private_connection_resource_id = azurerm_redis_cache.modex.id
    subresource_names              = ["redisCache"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "redis-dns-zone-group"
    private_dns_zone_ids = [azurerm_private_dns_zone.redis.id]
  }

  tags = var.common_tags
}

# Store Redis connection string in Key Vault
resource "azurerm_key_vault_secret" "redis_connection_string" {
  name         = "redis-connection-string"
  value        = azurerm_redis_cache.modex.primary_connection_string
  key_vault_id = azurerm_key_vault.modex.id

  depends_on = [azurerm_key_vault.modex]
}

# Store Redis primary key in Key Vault
resource "azurerm_key_vault_secret" "redis_primary_key" {
  name         = "redis-primary-key"
  value        = azurerm_redis_cache.modex.primary_access_key
  key_vault_id = azurerm_key_vault.modex.id

  depends_on = [azurerm_key_vault.modex]
}