# API Configuration

## Server URL Configuration

Для изменения URL сервера необходимо обновить константу в файле `src/app/constants/api.constants.ts`:

```typescript
export const API_CONSTANTS = {
  SERVER_URL: 'https://your-new-server-url.com',
  GRAPHQL_ENDPOINT: '/graphql'
} as const;
```

## Файлы, которые автоматически используют новую конфигурацию:

1. **src/app/app.config.ts** - Apollo Client конфигурация
2. **test-graphql.html** - тестовый файл для GraphQL запросов

## Текущая конфигурация:

- **Server URL**: `https://saobracaj-serveer-69637270851.europe-west3.run.app`
- **GraphQL Endpoint**: `/graphql`
- **Full GraphQL URL**: `https://saobracaj-serveer-69637270851.europe-west3.run.app/graphql`

## Как изменить URL:

1. Откройте файл `src/app/constants/api.constants.ts`
2. Измените значение `SERVER_URL` на новый URL
3. Перезапустите приложение: `ng serve`

Все компоненты и сервисы автоматически будут использовать новый URL через функцию `getGraphQLUrl()`.
