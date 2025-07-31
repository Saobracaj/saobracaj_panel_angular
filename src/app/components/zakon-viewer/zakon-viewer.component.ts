import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { MarkdownComponent } from 'ngx-markdown';
import { ZakonService, ZakonItem, ZakonNavigationRequest } from '../../services/zakon.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-zakon-viewer',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatDividerModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    FormsModule,
    HttpClientModule,
    MarkdownComponent
  ],
  templateUrl: './zakon-viewer.component.html',
  styleUrl: './zakon-viewer.component.scss'
})
export class ZakonViewerComponent implements OnInit, OnDestroy {
  zakonData: ZakonItem[] = [];
  filteredData: ZakonItem[] = [];

  isLoading = false;
  error: string | null = null;
  
  // Язык отображения
  currentLanguage: 'sr' | 'ru' = 'sr';
  
  // Поле для вставки ссылки
  linkInput = '';
  
  // Видимость колонки
  @Input() isVisible = true;
  
  @Output() visibilityChanged = new EventEmitter<boolean>();
  

  

  

  
  private destroy$ = new Subject<void>();

  constructor(
    private zakonService: ZakonService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadZakonData();
    
    // Подписываемся на запросы навигации
    this.zakonService.navigationRequest$
      .pipe(takeUntil(this.destroy$))
      .subscribe(request => {
        this.handleNavigationRequest(request);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadZakonData(): void {
    this.isLoading = true;
    this.error = null;

    this.zakonService.loadZakonData().subscribe({
      next: (data) => {
        console.log('Компонент получил данные закона:', data.length, 'элементов');
        this.zakonData = data;
        this.filteredData = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Ошибка загрузки данных закона в компоненте:', error);
        this.error = 'Ошибка загрузки данных закона';
        this.isLoading = false;
      }
    });
  }



  toggleLanguage(): void {
    this.currentLanguage = this.currentLanguage === 'sr' ? 'ru' : 'sr';
  }



  copyLink(item: ZakonItem): void {
    const link = this.zakonService.generateLink(item);
    navigator.clipboard.writeText(link).then(() => {
      this.snackBar.open('Ссылка скопирована в буфер обмена', 'Закрыть', {
        duration: 2000
      });
    }).catch(() => {
      this.snackBar.open('Ошибка копирования ссылки', 'Закрыть', {
        duration: 2000
      });
    });
  }

  getDisplayText(item: ZakonItem): string {
    return item[this.currentLanguage];
  }





  clearFilters(): void {
    this.filteredData = this.zakonData;
  }

  navigateToLink(): void {
    if (!this.linkInput.trim()) return;

    try {
      // Парсим ссылку вида zakon?chapter=IV&chlan=22&paragraph=4
      const url = new URL(this.linkInput, window.location.origin);
      const chapter = url.searchParams.get('chapter');
      const chlan = url.searchParams.get('chlan');
      const paragraph = url.searchParams.get('paragraph');

      // Проверяем, что хотя бы один параметр передан
      if (!chapter && !chlan && !paragraph) {
        this.snackBar.open('Неверный формат ссылки', 'Закрыть', { duration: 3000 });
        return;
      }

      // Ищем первый подходящий элемент
      const itemIndex = this.filteredData.findIndex(item => {
        // Проверяем каждый параметр, если он передан
        const chapterMatch = !chapter || item.chapter === chapter;
        const chlanMatch = !chlan || item.chlan === chlan;
        const paragraphMatch = !paragraph || item.paragraph === paragraph;
        
        return chapterMatch && chlanMatch && paragraphMatch;
      });

      if (itemIndex === -1) {
        this.snackBar.open('Параграф не найден', 'Закрыть', { duration: 3000 });
        return;
      }

      // Скроллим к элементу
      this.scrollToItem(itemIndex);
      
      // Формируем сообщение о найденном элементе
      const foundItem = this.filteredData[itemIndex];
      const message = `Переход к параграфу ${foundItem.chapter || '*'}.${foundItem.chlan || '*'}.${foundItem.paragraph || '*'}`;
      this.snackBar.open(message, 'Закрыть', { duration: 2000 });
      this.linkInput = '';
      
    } catch (error) {
      this.snackBar.open('Ошибка при обработке ссылки', 'Закрыть', { duration: 3000 });
    }
  }

  private scrollToItem(index: number): void {
    setTimeout(() => {
      const items = document.querySelectorAll('.zakon-item');
      if (items[index]) {
        items[index].scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        
        // Добавляем визуальное выделение
        const element = items[index] as HTMLElement;
        element.style.backgroundColor = 'rgba(25, 118, 210, 0.1)';
        element.style.border = '2px solid #1976d2';
        
        setTimeout(() => {
          element.style.backgroundColor = '';
          element.style.border = '';
        }, 3000);
      }
    }, 100);
  }

  toggleVisibility(): void {
    this.isVisible = !this.isVisible;
    this.visibilityChanged.emit(this.isVisible);
  }

  private handleNavigationRequest(request: ZakonNavigationRequest): void {
    // Показываем панель, если требуется
    if (request.showPanel && !this.isVisible) {
      this.toggleVisibility();
    }
    
    // Парсим ссылку и выполняем навигацию
    const zakonParams = this.zakonService.parseZakonLink(request.link);
    if (zakonParams) {
      this.navigateToZakonParams(zakonParams);
    }
  }

  private navigateToZakonParams(params: { chapter?: string; chlan?: string; paragraph?: string }): void {
    // Ищем подходящий элемент в данных
    const itemIndex = this.filteredData.findIndex(item => {
      const chapterMatch = !params.chapter || item.chapter === params.chapter;
      const chlanMatch = !params.chlan || item.chlan === params.chlan;
      const paragraphMatch = !params.paragraph || item.paragraph === params.paragraph;
      
      return chapterMatch && chlanMatch && paragraphMatch;
    });

    if (itemIndex === -1) {
      this.snackBar.open('Параграф не найден', 'Закрыть', { duration: 3000 });
      return;
    }

    // Скроллим к элементу
    this.scrollToItem(itemIndex);
    
    // Формируем сообщение о найденном элементе
    const foundItem = this.filteredData[itemIndex];
    const message = `Переход к параграфу ${foundItem.chapter || '*'}.${foundItem.chlan || '*'}.${foundItem.paragraph || '*'}`;
    this.snackBar.open(message, 'Закрыть', { duration: 2000 });
  }


} 