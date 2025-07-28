import { Component, OnInit } from '@angular/core';
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
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, Comment, CommentNotification } from '../../services/auth.service';

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
    MatDividerModule
  ],
  templateUrl: './questions.component.html',
  styleUrl: './questions.component.scss'
})
export class QuestionsComponent implements OnInit {
  questions: Question[] = [];
  russianTranslations: RussianTranslation[] = [];
  questionStatuses: QuestionStatus[] = [];
  isLoading: boolean = true;
  isLoadingStatuses: boolean = false;
  error: string | null = null;
  statusesError: string | null = null;
  selectedQuestionId: number | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadQuestions();
    
    // Подписываемся на изменения параметров URL
    this.route.params.subscribe(params => {
      if (params['id']) {
        const questionId = parseInt(params['id']);
        this.selectQuestion(questionId);
      }
    });
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
        this.questions = questions;
        
        // Загружаем русские переводы
        return this.loadRussianTranslations();
      })
      .then(() => {
        this.isLoading = false;
        
        // Создаем статусы по умолчанию (PENDING) для всех вопросов
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
        // Обновляем статусы для всех вопросов
        this.questionStatuses = this.questions.map(question => {
          // Ищем соответствующий комментарий по ID
          const comment = comments.find(c => c.id === question.qId.toString());
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
    this.selectedQuestionId = questionId;
    // Обновляем URL с ID вопроса
    this.router.navigate(['/questions', questionId], { replaceUrl: true });
    // Здесь будет логика для отображения контента справа
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
} 