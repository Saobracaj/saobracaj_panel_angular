import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenu } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, Comment, CommentNotification } from '../../services/auth.service';
import { CommentService, CommentDetail, InnerMessage } from '../../services/comment.service';
import { ZakonService, ZakonNavigationRequest } from '../../services/zakon.service';
import { MarkdownEditorComponent } from '../markdown-editor/markdown-editor.component';
import { ZakonViewerComponent } from '../zakon-viewer/zakon-viewer.component';
import { interval, Subscription, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface Question {
  qId: number;
  qcId: number;
  Text: string;
  ChoicesReq: number;
  HasImage: boolean;
  Points: number;
  Choices: Array<{
    Text: string;
    isCorrect: boolean;
  }>;
  categoryId: string;
  subcategoryId: number;
  zakon?: string;
}

interface RussianTranslation {
  qId: number;
  qcId: number;
  Text: string;
  Choices: Array<{
    Text: string;
  }>;
}

interface QuestionStatus {
  id: string;
  status: 'PENDING' | 'DRAFT' | 'MODERATION' | 'READY';
}

@Component({
  selector: 'app-questions',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatBadgeModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    FormsModule,
    MarkdownEditorComponent,
    ZakonViewerComponent
  ],
  templateUrl: './questions.component.html',
  styleUrl: './questions.component.scss'
})
export class QuestionsComponent implements OnInit, OnDestroy {
  questions: Question[] = [];
  russianTranslations: RussianTranslation[] = [];
  questionStatuses: QuestionStatus[] = [];
  isLoading: boolean = true;
  isLoadingStatuses: boolean = false;
  error: string | null = null;
  statusesError: string | null = null;
  selectedQuestionId: number | null = null;
  
  // Свойства для оповещений
  notifications: CommentNotification[] = [];
  isLoadingNotifications: boolean = false;
  notificationsError: string | null = null;
  private notificationsSubscription: Subscription | null = null;
  private notificationsTimer: Subscription | null = null;
  private destroy$ = new Subject<void>();
  
  // Свойства для внутренних комментариев
  innerMessages: InnerMessage[] = [];
  isLoadingInnerMessages: boolean = false;
  newInnerMessage: string = '';
  isAddingInnerMessage: boolean = false;
  
  // Видимость колонки с законом
  isZakonVisible = true;
  
  @ViewChild('notificationsMenu') notificationsMenu!: MatMenu;

  constructor(
    private authService: AuthService,
    private commentService: CommentService,
    private zakonService: ZakonService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Загружаем данные
    this.loadQuestions();
    this.loadRussianTranslations();
    this.loadQuestionStatuses();
    this.loadNotifications();
    this.startNotificationsTimer();
    
    // Подписываемся на запросы навигации по закону
    this.zakonService.navigationRequest$
      .pipe(takeUntil(this.destroy$))
      .subscribe(request => {
        if (request.showPanel && !this.isZakonVisible) {
          this.showZakon();
        }
      });
    
    // Подписываемся на изменения параметров URL
    this.route.params.subscribe(params => {
      if (params['id']) {
        const questionId = parseInt(params['id']);
        this.selectQuestion(questionId);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.notificationsSubscription) {
      this.notificationsSubscription.unsubscribe();
    }
    if (this.notificationsTimer) {
      this.notificationsTimer.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadQuestions(): void {
    this.isLoading = true;
    this.error = null;

    // Загружаем вопросы из JSON файла
    fetch('/allQuestions.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Ошибка загрузки вопросов');
        }
        return response.json();
      })
      .then((questions: Question[]) => {
        // Фильтруем вопросы, исключая категорию 38
        this.questions = questions.filter(q => q.categoryId !== '38');
        
        // Загружаем русские переводы
        return this.loadRussianTranslations();
      })
      .then(() => {
        this.isLoading = false;
        
        // Создаем статусы по умолчанию (PENDING) для отфильтрованных вопросов
        this.questionStatuses = this.questions.map(q => ({
          id: q.qId.toString(),
          status: 'PENDING' as const
        }));
        
        // Теперь загружаем реальные статусы с сервера
        this.loadQuestionStatuses();
        
        // После загрузки вопросов проверяем URL
        this.route.params.subscribe(params => {
          if (params['id']) {
            const questionId = parseInt(params['id']);
            if (this.questions.some(q => q.qId === questionId)) {
              this.selectQuestion(questionId);
            }
          }
        });
      })
      .catch(error => {
        console.error('Ошибка загрузки вопросов:', error);
        this.error = 'Ошибка загрузки вопросов';
        this.isLoading = false;
        this.snackBar.open('Ошибка загрузки вопросов', 'Закрыть', {
          duration: 5000
        });
      });
  }

  loadRussianTranslations(): Promise<void> {
    return fetch('/allQuestions_ru.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('Ошибка загрузки русских переводов');
        }
        return response.json();
      })
      .then((translations: RussianTranslation[]) => {
        this.russianTranslations = translations;
      })
      .catch(error => {
        console.error('Ошибка загрузки русских переводов:', error);
        // Не показываем ошибку пользователю, так как переводы не критичны
        this.russianTranslations = [];
      });
  }

  getRussianTranslation(questionId: number): RussianTranslation | undefined {
    return this.russianTranslations.find(t => t.qId === questionId);
  }

  getRussianChoiceTranslation(questionId: number, choiceIndex: number): string | undefined {
    const translation = this.getRussianTranslation(questionId);
    return translation?.Choices?.[choiceIndex]?.Text;
  }

  loadQuestionStatuses(): void {
    this.isLoadingStatuses = true;
    this.statusesError = null;

    // GraphQL запрос для получения статусов комментариев
    this.authService.getComments().subscribe({
      next: (comments) => {
        console.log('Получены комментарии с сервера:', comments);
        console.log('Общее количество комментариев:', comments.length);
        console.log('Общее количество вопросов:', this.questions.length);
        
        // Обновляем статусы для всех вопросов
        this.questionStatuses = this.questions.map(question => {
          // Ищем соответствующий комментарий по ID
          // Приводим оба значения к числу для корректного сравнения
          const comment = comments.find(c => {
            const commentId = typeof c.id === 'string' ? parseInt(c.id, 10) : c.id;
            return commentId === question.qId;
          });
          
          // Логируем только если комментарий найден или для первых 5 вопросов
          if (comment || question.qId <= 7925) {
            // console.log(`Поиск комментария для вопроса ${question.qId}:`, {
            //   questionId: question.qId,
            //   foundComment: comment,
            //   commentId: comment?.id,
            //   status: comment?.status || 'PENDING'
            // });
          }
          
          return {
            id: question.qId.toString(),
            // Если статуса нет в ответе сервера, оставляем PENDING
            status: comment ? comment.status : 'PENDING'
          };
        });
        
        this.isLoadingStatuses = false;
      },
      error: (error) => {
        console.error('Ошибка загрузки статусов:', error);
        this.statusesError = 'Ошибка загрузки статусов';
        this.isLoadingStatuses = false;
        
        // Если токен истек, попробуем обновить его
        if (error.graphQLErrors?.some((e: any) => e.extensions?.code === 'token_expired')) {
          this.refreshTokenAndRetry();
        } else {
          // Если не удалось загрузить статусы, оставляем PENDING для всех
          this.questionStatuses = this.questions.map(q => ({
            id: q.qId.toString(),
            status: 'PENDING' as const
          }));
          this.isLoadingStatuses = false;
          this.snackBar.open('Ошибка загрузки статусов', 'Закрыть', {
            duration: 5000
          });
        }
      }
    });
  }

  loadNotifications(): void {
    this.isLoadingNotifications = true;
    this.notificationsError = null;

    this.notificationsSubscription = this.authService.getCommentNotifications().subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.isLoadingNotifications = false;
      },
      error: (error) => {
        this.notificationsError = 'Ошибка загрузки оповещений';
        this.isLoadingNotifications = false;
        
        // Если токен истек, попробуем обновить его
        if (error.graphQLErrors?.some((e: any) => e.extensions?.code === 'token_expired')) {
          this.refreshTokenAndRetry();
        }
      }
    });
  }

  startNotificationsTimer(): void {
    // Отписываемся от предыдущего таймера, если он существует
    if (this.notificationsTimer) {
      this.notificationsTimer.unsubscribe();
    }
    
    // Обновляем оповещения каждые 15 секунд
    this.notificationsTimer = interval(15000).subscribe(() => {
      this.loadNotifications();
    });
  }

  markNotificationsAsRead(): void {
    if (this.notifications.length === 0) {
      this.snackBar.open('Нет оповещений', 'Закрыть', {
        duration: 2000
      });
      return;
    }

    // Находим непрочитанные оповещения
    const unreadNotifications = this.notifications.filter(n => !n.read);
    
    if (unreadNotifications.length === 0) {
      this.snackBar.open('Все оповещения прочитаны', 'Закрыть', {
        duration: 2000
      });
      return;
    }

    // Берем время создания самого нового оповещения
    const latestNotification = unreadNotifications.reduce((latest, current) => {
      return current.created > latest.created ? current : latest;
    });

    this.authService.readNotifications(latestNotification.created.toString()).subscribe({
      next: (updatedNotifications) => {
        // Обновляем локальный список оповещений
        this.notifications = updatedNotifications;
        this.snackBar.open('Оповещения помечены как прочитанные', 'Закрыть', {
          duration: 2000
        });
      },
      error: (error) => {
        this.snackBar.open('Ошибка при обновлении оповещений', 'Закрыть', {
          duration: 3000
        });
      }
    });
  }

  getUnreadNotificationsCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  markAllNotificationsAsRead(): void {
    if (this.notifications.length === 0) {
      this.snackBar.open('Нет оповещений для отметки', 'Закрыть', {
        duration: 2000
      });
      return;
    }

    const unreadNotifications = this.notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) {
      this.snackBar.open('Все оповещения уже прочитаны', 'Закрыть', {
        duration: 2000
      });
      return;
    }

    // Берем время создания самого нового оповещения
    const latestNotification = unreadNotifications.reduce((latest, current) => {
      return current.created > latest.created ? current : latest;
    });

    this.authService.readNotifications(latestNotification.created.toString()).subscribe({
      next: (updatedNotifications) => {
        this.notifications = updatedNotifications;
        this.snackBar.open('Все оповещения помечены как прочитанные', 'Закрыть', {
          duration: 2000
        });
      },
      error: (error) => {
        this.snackBar.open('Ошибка при обновлении оповещений', 'Закрыть', {
          duration: 3000
        });
      }
    });
  }

  formatNotificationTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Только что';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} мин назад`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} ч назад`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} дн назад`;
    }
  }

  onNotificationClick(notification: CommentNotification): void {
    // Переходим к соответствующему вопросу
    this.selectQuestion(notification.qId);
    
    // Показываем уведомление о переходе
    this.snackBar.open(`Переход к вопросу #${notification.qId}`, 'Закрыть', {
      duration: 2000
    });
  }

  onNotificationsMenuClosed(): void {
    // Меню оповещений закрыто - можно добавить дополнительную логику при необходимости
  }



  getStatusIcon(status: string): string {
    switch (status) {
      case 'PENDING':
        return '⏳'; // песочные часы
      case 'DRAFT':
        return '📝'; // черновик
      case 'MODERATION':
        return '👁️'; // глаз для модерации
      case 'READY':
        return '✅'; // галочка
      default:
        return '❓';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'orange';
      case 'DRAFT':
        return 'gray';
      case 'MODERATION':
        return 'blue';
      case 'READY':
        return 'green';
      default:
        return 'gray';
    }
  }

  selectQuestion(questionId: number): void {
    console.log('Выбран вопрос:', questionId);
    this.selectedQuestionId = questionId;
    // Обновляем URL с ID вопроса
    this.router.navigate(['/questions', questionId], { replaceUrl: true });
    // Загружаем внутренние комментарии для выбранного вопроса
    this.loadInnerMessages(questionId);
  }

  getQuestionStatus(questionId: number): QuestionStatus | undefined {
    return this.questionStatuses.find(status => status.id === questionId.toString());
  }

  getSelectedQuestion(): Question | undefined {
    if (!this.selectedQuestionId) return undefined;
    return this.questions.find(q => q.qId === this.selectedQuestionId);
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const container = img.parentElement;
    if (container) {
      container.innerHTML = '<p>Изображение недоступно</p>';
    }
  }

  onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.opacity = '1';
  }

  private refreshTokenAndRetry(): void {
    this.authService.refreshToken().subscribe({
      next: () => {
        // Повторяем запросы после обновления токена
        this.loadQuestions();
        this.loadQuestionStatuses();
        this.loadNotifications();
      },
      error: (refreshError) => {
        console.error('Ошибка обновления токена:', refreshError);
        this.snackBar.open('Сессия истекла. Пожалуйста, войдите снова.', 'Закрыть', {
          duration: 5000
        });
        this.logout();
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
    this.snackBar.open('Вы вышли из системы', 'Закрыть', {
      duration: 3000
    });
  }

  trackByQuestionId(index: number, question: Question): number {
    return question.qId;
  }

  onCommentUpdated(comment: CommentDetail): void {
    console.log('Комментарий обновлен:', comment);
    // Обновляем статус вопроса в списке
    const questionIndex = this.questionStatuses.findIndex(s => s.id === comment.id);
    if (questionIndex !== -1) {
      this.questionStatuses[questionIndex].status = comment.status;
      console.log(`Обновлен статус вопроса ${comment.id} на ${comment.status}`);
    } else {
      console.log(`Не найден вопрос с ID ${comment.id} для обновления статуса`);
    }
  }

  getStatusStatistics(): { status: string; count: number; icon: string; color: string }[] {
    const stats = {
      'PENDING': 0,
      'DRAFT': 0,
      'MODERATION': 0,
      'READY': 0
    };

    // Учитываем только статусы отфильтрованных вопросов
    this.questionStatuses.forEach(status => {
      // Проверяем, что вопрос с этим статусом существует в отфильтрованном списке
      const questionExists = this.questions.some(q => q.qId.toString() === status.id);
      if (questionExists && stats.hasOwnProperty(status.status)) {
        stats[status.status as keyof typeof stats]++;
      }
    });

    return [
      { status: 'PENDING', count: stats.PENDING, icon: '⏳', color: 'orange' },
      { status: 'DRAFT', count: stats.DRAFT, icon: '📝', color: 'gray' },
      { status: 'MODERATION', count: stats.MODERATION, icon: '👁️', color: 'blue' },
      { status: 'READY', count: stats.READY, icon: '✅', color: 'green' }
    ];
  }

  // Методы для работы с внутренними комментариями
  loadInnerMessages(questionId: number): void {
    if (!questionId) return;
    
    this.isLoadingInnerMessages = true;
    this.commentService.getComment(questionId).subscribe({
      next: (comment) => {
        // Создаем копию массива и сортируем комментарии по времени создания (новые сначала)
        this.innerMessages = [...(comment.innerMessages || [])].sort((a, b) => 
          parseInt(b.created) - parseInt(a.created)
        );
        this.isLoadingInnerMessages = false;
      },
      error: (error) => {
        console.error('Ошибка загрузки внутренних комментариев:', error);
        this.isLoadingInnerMessages = false;
        this.snackBar.open('Ошибка загрузки комментариев', 'Закрыть', {
          duration: 3000
        });
      }
    });
  }

  addInnerMessage(): void {
    if (!this.selectedQuestionId || !this.newInnerMessage.trim()) return;
    
    this.isAddingInnerMessage = true;
    this.commentService.addInnerMessage(this.selectedQuestionId, this.newInnerMessage.trim()).subscribe({
      next: (messages) => {
        // Создаем копию массива и сортируем комментарии по времени создания (новые сначала)
        this.innerMessages = [...messages].sort((a, b) => 
          parseInt(b.created) - parseInt(a.created)
        );
        this.newInnerMessage = '';
        this.isAddingInnerMessage = false;
        this.snackBar.open('Комментарий добавлен', 'Закрыть', {
          duration: 2000
        });
      },
      error: (error) => {
        console.error('Ошибка добавления комментария:', error);
        this.isAddingInnerMessage = false;
        this.snackBar.open('Ошибка добавления комментария', 'Закрыть', {
          duration: 3000
        });
      }
    });
  }

  formatInnerMessageTime(timestamp: string): string {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  onEnterKeyPress(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      event.preventDefault();
      this.addInnerMessage();
    }
  }

  // Генерируем цвет на основе ID пользователя
  getUserColor(userId: string): string {
    // Создаем хеш из userId для получения предсказуемого цвета
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Преобразуем в 32-битное целое
    }
    
    // Используем хеш для генерации более контрастного цвета
    const hue = Math.abs(hash) % 360;
    const saturation = 70 + (Math.abs(hash) % 25); // 70-95% (более насыщенные)
    const lightness = 45 + (Math.abs(hash) % 20); // 45-65% (средняя яркость для лучшего контраста)
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  onZakonVisibilityChanged(isVisible: boolean): void {
    this.isZakonVisible = isVisible;
  }

  showZakon(): void {
    this.isZakonVisible = true;
  }
} 