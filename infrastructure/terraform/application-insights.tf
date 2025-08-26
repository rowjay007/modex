# Application Insights Integration for Modex Services

# Application Insights Web Tests
resource "azurerm_application_insights_web_test" "api_gateway" {
  name                    = "api-gateway-availability"
  location                = azurerm_application_insights.modex.location
  resource_group_name     = azurerm_resource_group.modex.name
  application_insights_id = azurerm_application_insights.modex.id
  kind                    = "ping"
  frequency               = 300
  timeout                 = 60
  enabled                 = true
  retry_enabled           = true
  geo_locations           = ["us-tx-sn1-azr", "us-il-ch1-azr", "us-ca-sjc-azr"]

  configuration = <<XML
<WebTest Name="API Gateway Health Check" Id="ABD48585-0831-40CB-9069-682A44B39EC3" Enabled="True" CssProjectStructure="" CssIteration="" Timeout="0" WorkItemIds="" xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010" Description="" CredentialUserName="" CredentialPassword="" PreAuthenticate="True" Proxy="default" StopOnError="False" RecordedResultFile="" ResultsLocale="">
  <Items>
    <Request Method="GET" Guid="a5f10126-e4cd-570d-961c-cea43999a200" Version="1.1" Url="https://api.modex.platform/health" ThinkTime="0" Timeout="300" ParseDependentRequests="True" FollowRedirects="True" RecordResult="True" Cache="False" ResponseTimeGoal="0" Encoding="utf-8" ExpectedHttpStatusCode="200" ExpectedResponseUrl="" ReportingName="" IgnoreHttpStatusCode="False" />
  </Items>
</WebTest>
XML

  tags = var.common_tags
}

# Custom Metrics and Alerts
resource "azurerm_monitor_metric_alert" "high_response_time" {
  name                = "high-response-time"
  resource_group_name = azurerm_resource_group.modex.name
  scopes              = [azurerm_application_insights.modex.id]
  description         = "Alert when API response time is too high"
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT15M"
  enabled             = true

  criteria {
    metric_namespace = "microsoft.insights/components"
    metric_name      = "requests/duration"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 2000 # 2 seconds
  }

  action {
    action_group_id = azurerm_monitor_action_group.platform_alerts.id
  }

  tags = var.common_tags
}

resource "azurerm_monitor_metric_alert" "high_failure_rate" {
  name                = "high-failure-rate"
  resource_group_name = azurerm_resource_group.modex.name
  scopes              = [azurerm_application_insights.modex.id]
  description         = "Alert when failure rate is too high"
  severity            = 1
  frequency           = "PT5M"
  window_size         = "PT10M"
  enabled             = true

  criteria {
    metric_namespace = "microsoft.insights/components"
    metric_name      = "requests/failed"
    aggregation      = "Count"
    operator         = "GreaterThan"
    threshold        = 10
  }

  action {
    action_group_id = azurerm_monitor_action_group.platform_alerts.id
  }

  tags = var.common_tags
}

# Action Group for Alerts
resource "azurerm_monitor_action_group" "platform_alerts" {
  name                = "platform-alerts"
  resource_group_name = azurerm_resource_group.modex.name
  short_name          = "platform"

  email_receiver {
    name          = "platform-team"
    email_address = "platform-alerts@modex.com"
  }

  webhook_receiver {
    name        = "slack-webhook"
    service_uri = "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
  }

  tags = var.common_tags
}

# Log Analytics Queries
resource "azurerm_log_analytics_saved_search" "error_analysis" {
  name                       = "error-analysis"
  log_analytics_workspace_id = azurerm_log_analytics_workspace.modex.id
  category                   = "Application"
  display_name               = "Error Analysis"
  query                      = <<QUERY
exceptions
| where timestamp > ago(1h)
| summarize count() by type, outerMessage
| order by count_ desc
QUERY

  tags = var.common_tags
}

resource "azurerm_log_analytics_saved_search" "performance_analysis" {
  name                       = "performance-analysis"
  log_analytics_workspace_id = azurerm_log_analytics_workspace.modex.id
  category                   = "Performance"
  display_name               = "Performance Analysis"
  query                      = <<QUERY
requests
| where timestamp > ago(1h)
| summarize avg(duration), percentile(duration, 95), percentile(duration, 99) by name
| order by avg_duration desc
QUERY

  tags = var.common_tags
}
