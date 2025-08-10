# Развертывание на Google Cloud Run

Это руководство поможет вам развернуть Angular приложение на Google Cloud Run.

## Предварительные требования

1. **Google Cloud SDK** - установите и настройте gcloud CLI
2. **Docker** - установите Docker Desktop или Docker Engine
3. **Google Cloud Project** - создайте проект в Google Cloud Console
4. **Включенные API** - убедитесь, что включены следующие API:
   - Cloud Run API
   - Container Registry API
   - Cloud Build API

## Быстрое развертывание

### 1. Настройка проекта

```bash
# Установите Google Cloud SDK (если еще не установлен)
# https://cloud.google.com/sdk/docs/install

# Войдите в аккаунт Google
gcloud auth login

# Установите проект по умолчанию
gcloud config set project YOUR_PROJECT_ID

# Включите необходимые API
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### 2. Развертывание с помощью скрипта

```bash
# Сделайте скрипт исполняемым (если еще не сделано)
chmod +x deploy.sh

# Запустите развертывание
./deploy.sh
```

### 3. Ручное развертывание

Если вы предпочитаете выполнить шаги вручную:

```bash
# 1. Соберите Docker образ
docker build -t gcr.io/YOUR_PROJECT_ID/saobracaj-panel .

# 2. Отправьте образ в Container Registry
docker push gcr.io/YOUR_PROJECT_ID/saobracaj-panel

# 3. Разверните на Cloud Run
gcloud run deploy saobracaj-panel \
  --image gcr.io/YOUR_PROJECT_ID/saobracaj-panel \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1
```

## Автоматическое развертывание с Cloud Build

Для автоматического развертывания при каждом push в репозиторий:

1. Подключите ваш Git репозиторий к Cloud Build
2. Настройте триггер для автоматического запуска `cloudbuild.yaml`
3. При каждом push будет происходить автоматическое развертывание

## Конфигурация

### Переменные окружения

Приложение использует следующие переменные окружения:

- `NODE_ENV=production` - режим работы
- `PORT=8080` - порт для прослушивания

### Ресурсы Cloud Run

- **Память**: 512Mi
- **CPU**: 1 vCPU
- **Максимум экземпляров**: 10
- **Минимум экземпляров**: 0 (cold start)
- **Таймаут**: 300 секунд

## Мониторинг и логи

```bash
# Просмотр логов
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=saobracaj-panel" --limit=50

# Просмотр метрик в консоли
# https://console.cloud.google.com/run/detail/europe-west1/saobracaj-panel/metrics
```

## Обновление приложения

Для обновления приложения просто запустите скрипт развертывания снова:

```bash
./deploy.sh
```

## Удаление

```bash
# Удалить сервис Cloud Run
gcloud run services delete saobracaj-panel --region=europe-west1

# Удалить образ из Container Registry
gcloud container images delete gcr.io/YOUR_PROJECT_ID/saobracaj-panel --force-delete-tags
```

## Устранение неполадок

### Проблемы с Docker

```bash
# Проверка Docker образа локально
docker run -p 8080:8080 gcr.io/YOUR_PROJECT_ID/saobracaj-panel

# Просмотр логов контейнера
docker logs <container_id>
```

### Проблемы с Cloud Run

```bash
# Проверка статуса сервиса
gcloud run services describe saobracaj-panel --region=europe-west1

# Просмотр последних развертываний
gcloud run revisions list --service=saobracaj-panel --region=europe-west1
```

## Стоимость

Cloud Run взимает плату только за время выполнения запросов. При отсутствии трафика экземпляры автоматически масштабируются до 0, что минимизирует затраты.

Примерная стоимость для небольшого приложения:
- 1 миллион запросов в месяц: ~$0.40
- 2 ГБ-часа CPU: ~$0.24
- 1 ГБ-час памяти: ~$0.10

**Итого**: ~$0.74 в месяц при умеренной нагрузке.
