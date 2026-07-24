// Infrastructure for the AI Cookbook API (Challenge 7 — Deployment).
// Provisions: Azure Container Registry + Linux App Service Plan +
// Web App for Containers, wired to pull the image and probe /api/health.
//
//   az group create -n cookbook-rg -l eastus
//   az deployment group create -g cookbook-rg -f infra/main.bicep -p infra/main.parameters.json

@description('Base name used to derive resource names.')
param appName string = 'cookbook'

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('App Service Plan SKU. B1 supports alwaysOn + health checks.')
param sku string = 'B1'

@description('Container image to run. The deploy pipeline overrides this with the ACR image tagged by commit SHA; the default is a public placeholder so the initial provision succeeds.')
param containerImage string = 'mcr.microsoft.com/azuredocs/aci-helloworld:latest'

var acrName = toLower('${appName}acr${uniqueString(resourceGroup().id)}')
var planName = '${appName}-plan'
var webAppName = toLower('${appName}-${uniqueString(resourceGroup().id)}')

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    // Admin user keeps App Service image pulls simple for a demo. For production,
    // prefer a managed identity with the AcrPull role instead.
    adminUserEnabled: true
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  sku: {
    name: sku
  }
  kind: 'linux'
  properties: {
    reserved: true // Linux
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  kind: 'app,linux,container'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${containerImage}'
      alwaysOn: true
      ftpsState: 'Disabled'
      healthCheckPath: '/api/health'
      appSettings: [
        { name: 'WEBSITES_PORT', value: '4000' }
        { name: 'PORT', value: '4000' }
        { name: 'NO_OPEN', value: '1' }
        { name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE', value: 'false' }
        { name: 'DOCKER_REGISTRY_SERVER_URL', value: 'https://${acr.properties.loginServer}' }
        { name: 'DOCKER_REGISTRY_SERVER_USERNAME', value: acr.listCredentials().username }
        { name: 'DOCKER_REGISTRY_SERVER_PASSWORD', value: acr.listCredentials().passwords[0].value }
      ]
    }
  }
}

output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
output webAppName string = webApp.name
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
