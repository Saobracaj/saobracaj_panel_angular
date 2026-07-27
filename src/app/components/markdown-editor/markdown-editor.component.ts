import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MarkdownComponent } from 'ngx-markdown';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { CommentService, CommentDetail } from '../../services/comment.service';
import { ZakonService } from '../../services/zakon.service';

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MarkdownComponent
  ],
  templateUrl: './markdown-editor.component.html',
  styleUrl: './markdown-editor.component.scss'
})
export class MarkdownEditorComponent implements OnInit, OnDestroy, OnChanges {
  @Input() questionId: string | number = '';
  @Output() commentUpdated = new EventEmitter<CommentDetail>();

  editorContent: string = '';
  isLoading: boolean = false;
  isSaving: boolean = false;
  isApplying: boolean = false;
  isSettingReady: boolean = false;
  commentDetail: CommentDetail | null = null;
  foundLinks: LinkInfo[] = [];

  private contentChangeSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private commentService: CommentService,
    private zakonService: ZakonService,
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

      this.contentChangeSubject
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(content => {
        this.extractLinks(content);
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
      this.isSettingReady = false;

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
        this.extractLinks(this.editorContent);
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

  extractLinks(content: string): void {
    this.foundLinks = this.extractLinksFromMarkdown(content);
  }

  private extractLinksFromMarkdown(content: string): LinkInfo[] {
    const links: LinkInfo[] = [];
    const lines = content.split('\n');
    const processedUrls = new Set<string>(); // Для избежания дубликатов

    lines.forEach((line, lineIndex) => {
      // Match markdown links: [text](url) - но исключаем изображения ![alt](url)
      const markdownLinkRegex = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;
      let match;

      while ((match = markdownLinkRegex.exec(line)) !== null) {
        const linkText = match[1];
        const linkUrl = match[2];

        // Проверяем, не обрабатывали ли мы уже эту ссылку
        if (!processedUrls.has(linkUrl)) {
          processedUrls.add(linkUrl);
          links.push({
            url: linkUrl,
            text: linkText,
            line: lineIndex + 1
          });
        }
      }

      // Также ищем обычные URL, но только если они не являются частью markdown ссылок
      // Используем более точный regex, который исключает URL внутри markdown ссылок
      const urlRegex = /(?<!\]\()https?:\/\/[^\s\)]+/g;
      const urlMatches = line.match(urlRegex);
      if (urlMatches) {
        urlMatches.forEach(url => {
          // Убираем возможные закрывающие скобки или другие символы
          const cleanUrl = url.replace(/[\)\]]+$/, '');

          if (!processedUrls.has(cleanUrl)) {
            processedUrls.add(cleanUrl);
            links.push({
              url: cleanUrl,
              text: cleanUrl,
              line: lineIndex + 1
            });
          }
        });
      }
    });

    return links;
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

  markReady(): void {
    if (!this.questionId || this.isSettingReady) return;

    if (this.commentDetail?.status === 'READY') {
      this.snackBar.open('Вопрос уже имеет статус READY', 'Закрыть', {
        duration: 2000
      });
      return;
    }

    this.isSettingReady = true;
    this.commentService.setStatus(this.questionId, 'READY').subscribe({
      next: (updatedComment) => {
        this.commentDetail = updatedComment;
        this.isSettingReady = false;
        this.commentUpdated.emit(updatedComment);
        this.snackBar.open('Статус READY установлен', 'Закрыть', {
          duration: 3000
        });
      },
      error: (error) => {
        console.error('Ошибка установки статуса READY:', error);
        this.snackBar.open('Ошибка установки статуса READY', 'Закрыть', {
          duration: 5000
        });
        this.isSettingReady = false;
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

  onLinkClick(link: LinkInfo): void {
    // Проверяем, является ли ссылка ссылкой на закон
    const zakonParams = this.zakonService.parseZakonLink(link.url);

    if (zakonParams) {
      // Это ссылка на закон - запрашиваем навигацию
      this.zakonService.navigateToLink(link.url, true);
      this.snackBar.open('Переход к закону...', 'Закрыть', {
        duration: 2000
      });
    } else if (link.url.startsWith('http://') || link.url.startsWith('https://')) {
      // Внешняя ссылка - открываем в новой вкладке
      window.open(link.url, '_blank');
    } else {
      // Неизвестный формат ссылки
      this.snackBar.open('Неизвестный формат ссылки', 'Закрыть', {
        duration: 3000
      });
    }
  }
}

interface LinkInfo {
  url: string;
  text?: string;
  line?: number;
}
