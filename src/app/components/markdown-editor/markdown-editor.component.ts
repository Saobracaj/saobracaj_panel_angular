import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { CommentService, CommentDetail } from '../../services/comment.service';
import { SimpleMDEDirective } from '../../directives/simplemde.directive';

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    SimpleMDEDirective
  ],
  templateUrl: './markdown-editor.component.html',
  styleUrl: './markdown-editor.component.scss'
})
export class MarkdownEditorComponent implements OnInit, OnDestroy, OnChanges {
  @Input() questionId: string | number = '';
  @Output() commentUpdated = new EventEmitter<CommentDetail>();
  @ViewChild(SimpleMDEDirective) simplemdeDirective!: SimpleMDEDirective;

  editorContent: string = '';
  isLoading: boolean = false;
  isSaving: boolean = false;
  isApplying: boolean = false;
  commentDetail: CommentDetail | null = null;
  
  private contentChangeSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private commentService: CommentService,
    private snackBar: MatSnackBar
  ) {
    // Настройка автоматического сохранения с задержкой
    this.contentChangeSubject
      .pipe(
        debounceTime(1000), // Задержка 1 секунда
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(content => {
        this.saveDraft(content);
      });
  }

  ngOnInit(): void {
    if (this.questionId) {
      this.loadComment();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['questionId'] && !changes['questionId'].firstChange) {
      // Сбрасываем состояние при смене вопроса
      this.editorContent = '';
      this.commentDetail = null;
      this.isLoading = false;
      this.isSaving = false;
      this.isApplying = false;
      
      if (this.questionId) {
        this.loadComment();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadComment(): void {
    if (!this.questionId) return;

    console.log('Загружаем комментарий для вопроса:', this.questionId);
    
    // Проверяем токен аутентификации
    const token = localStorage.getItem('accessToken');
    console.log('Токен аутентификации:', token ? 'доступен' : 'отсутствует');
    
    this.isLoading = true;
    this.commentService.getComment(this.questionId).subscribe({
      next: (comment) => {
        console.log('Получен комментарий:', comment);
        this.commentDetail = comment;
        // Загружаем черновик, если есть, иначе основной текст
        this.loadEditorContent(comment);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Ошибка загрузки комментария:', error);
        console.error('Детали ошибки:', {
          message: error.message,
          graphQLErrors: error.graphQLErrors,
          networkError: error.networkError,
          extraInfo: error.extraInfo
        });
        this.snackBar.open('Ошибка загрузки комментария', 'Закрыть', {
          duration: 5000
        });
        this.isLoading = false;
      }
    });
  }

  private loadEditorContent(comment: CommentDetail): void {
    console.log('Загружаем содержимое редактора из комментария:', comment);
    
    // Приоритет: черновик -> основной текст
    if (comment.draft?.text && comment.draft.text.length > 0) {
      // Берем первый язык из черновика
      this.editorContent = comment.draft.text[0]?.text || '';
      console.log('Загружен черновик:', this.editorContent);
    } else if (comment.text?.text && comment.text.text.length > 0) {
      // Берем первый язык из основного текста
      this.editorContent = comment.text.text[0]?.text || '';
      console.log('Загружен основной текст:', this.editorContent);
    } else {
      this.editorContent = '';
      console.log('Нет содержимого для загрузки');
    }
  }

  onContentChange(content: string): void {
    this.editorContent = content;
    // Отправляем в Subject для автоматического сохранения
    this.contentChangeSubject.next(content);
  }

  private saveDraft(content: string): void {
    if (!this.questionId || this.isSaving) return;

    this.isSaving = true;
    this.commentService.saveDraft(this.questionId, content).subscribe({
      next: (updatedComment) => {
        this.commentDetail = updatedComment;
        this.isSaving = false;
        this.commentUpdated.emit(updatedComment);
      },
      error: (error) => {
        console.error('Ошибка сохранения черновика:', error);
        this.snackBar.open('Ошибка сохранения черновика', 'Закрыть', {
          duration: 5000
        });
        this.isSaving = false;
      }
    });
  }

  applyDraft(): void {
    if (!this.questionId || this.isApplying) return;

    this.isApplying = true;
    this.commentService.applyDraft(this.questionId).subscribe({
      next: (updatedComment) => {
        this.commentDetail = updatedComment;
        this.isApplying = false;
        this.commentUpdated.emit(updatedComment);
        this.snackBar.open('Черновик применен', 'Закрыть', {
          duration: 3000
        });
      },
      error: (error) => {
        console.error('Ошибка применения черновика:', error);
        this.snackBar.open('Ошибка применения черновика', 'Закрыть', {
          duration: 5000
        });
        this.isApplying = false;
      }
    });
  }

  getStatusText(): string {
    if (!this.commentDetail) return '';
    
    switch (this.commentDetail.status) {
      case 'PENDING':
        return 'Ожидает';
      case 'DRAFT':
        return 'Черновик';
      case 'MODERATION':
        return 'На модерации';
      case 'READY':
        return 'Готово';
      default:
        return '';
    }
  }
} 