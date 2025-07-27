# Saobracaj Panel

Angular приложение для работы с GraphQL API, включающее систему авторизации и отображение списка комментариев.

## Функциональность

### Авторизация
- Форма входа с email и паролем
- Автоматическое сохранение токенов в localStorage
- Автоматическое обновление access token при истечении
- Защищенные маршруты с помощью AuthGuard

### GraphQL интеграция
- Подключение к GraphQL серверу на `http://0.0.0.0:8080/graphql`
- Автоматическое добавление Bearer токена к запросам
- Обработка ошибок истекшего токена

### Компоненты
- **LoginComponent** - форма авторизации с Material Design
- **CommentsComponent** - отображение списка комментариев
- **AuthService** - сервис для работы с авторизацией и GraphQL
- **AuthGuard** - защита маршрутов

## Установка и запуск

1. Установите зависимости:
```bash
npm install
```

2. Убедитесь, что GraphQL сервер запущен на `http://0.0.0.0:8080/graphql`

3. Запустите приложение:
```bash
ng serve
```

4. Откройте браузер и перейдите на `http://localhost:4200`

## API Endpoints

### Авторизация
```graphql
query Auth($email: String!, $password: String!) {
  auth(email: $email, password: $password) {
    accessToken
    refreshToken
  }
}
```

### Обновление токена
```graphql
query RefreshToken($refreshToken: String!) {
  refreshToken(refreshToken: $refreshToken) {
    accessToken
    refreshToken
  }
}
```

### Получение комментариев
```graphql
query Comments {
  comments {
    id
  }
}
```

## Структура проекта

```
src/
├── app/
│   ├── components/
│   │   ├── login/
│   │   │   ├── login.component.ts
│   │   │   ├── login.component.html
│   │   │   └── login.component.scss
│   │   └── comments/
│   │       ├── comments.component.ts
│   │       ├── comments.component.html
│   │       └── comments.component.scss
│   ├── services/
│   │   └── auth.service.ts
│   ├── guards/
│   │   └── auth.guard.ts
│   ├── app.component.ts
│   ├── app.component.html
│   ├── app.component.scss
│   ├── app.config.ts
│   └── app.routes.ts
```

## Технологии

- Angular 19
- Angular Material
- Apollo Client для GraphQL
- RxJS
- TypeScript

## Особенности

- Адаптивный дизайн для мобильных устройств
- Обработка ошибок с уведомлениями
- Автоматическое обновление токенов
- Защита от серверного рендеринга (SSR)
- Красивый UI с Material Design
