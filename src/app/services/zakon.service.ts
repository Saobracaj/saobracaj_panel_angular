import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, Subject } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface ZakonItem {
  chapter: string | null;
  paragraph: string | null;
  chlan: string | null;
  sr: string;
  ru: string;
  isTitle: boolean;
}

export interface ZakonSearchResult {
  item: ZakonItem;
  index: number;
  matchText: string;
}

export interface ZakonNavigationRequest {
  link: string;
  showPanel?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ZakonService {
  private zakonData: ZakonItem[] = [];
  private isLoaded = false;
  
  // Subject для коммуникации между компонентами
  private navigationRequestSubject = new Subject<ZakonNavigationRequest>();
  public navigationRequest$ = this.navigationRequestSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Метод для запроса навигации по ссылке
  navigateToLink(link: string, showPanel: boolean = true): void {
    this.navigationRequestSubject.next({ link, showPanel });
  }

  // Метод для парсинга ссылки на закон
  parseZakonLink(url: string): { chapter?: string; chlan?: string; paragraph?: string } | null {
    try {
      // Если ссылка содержит полный URL с доменом, извлекаем только часть с параметрами
      let linkToParse = url;
      
      // Проверяем, содержит ли ссылка домен и zakon
      if (url.includes('zakon') && (url.includes('http://') || url.includes('https://'))) {
        // Извлекаем часть после /zakon
        const zakonIndex = url.indexOf('/zakon');
        if (zakonIndex !== -1) {
          linkToParse = url.substring(zakonIndex + 1); // +1 чтобы убрать /
        }
      }
      
      // Если ссылка не содержит протокол, добавляем базовый URL для парсинга
      if (!linkToParse.startsWith('http')) {
        linkToParse = 'http://localhost' + (linkToParse.startsWith('/') ? '' : '/') + linkToParse;
      }
      
      const urlObj = new URL(linkToParse);
      const chapter = urlObj.searchParams.get('chapter') || undefined;
      const chlan = urlObj.searchParams.get('chlan') || undefined;
      const paragraph = urlObj.searchParams.get('paragraph') || undefined;
      
      // Возвращаем результат только если есть хотя бы один параметр
      if (chapter || chlan || paragraph) {
        return { chapter, chlan, paragraph };
      }
      
      return null;
    } catch (error) {
      console.error('Ошибка парсинга ссылки:', error);
      return null;
    }
  }

  loadZakonData(): Observable<ZakonItem[]> {
    if (this.isLoaded) {
      return of(this.zakonData);
    }

    return this.http.get<ZakonItem[]>('/parsed_zakon.json').pipe(
      map(data => {
        console.log('Данные закона загружены:', data.length, 'элементов');
        this.zakonData = data;
        this.isLoaded = true;
        return data;
      }),
      catchError(error => {
        console.error('Ошибка загрузки данных закона:', error);
        console.error('URL запроса:', '/parsed_zakon.json');
        return of([]);
      })
    );
  }

  getZakonData(): ZakonItem[] {
    return this.zakonData;
  }

  searchZakon(query: string, language: 'sr' | 'ru' = 'sr'): ZakonSearchResult[] {
    if (!query.trim() || !this.isLoaded) {
      return [];
    }

    const results: ZakonSearchResult[] = [];
    const searchQuery = query.toLowerCase();

    this.zakonData.forEach((item, index) => {
      const text = item[language].toLowerCase();
      if (text.includes(searchQuery)) {
        // Находим позицию совпадения для выделения
        const matchIndex = text.indexOf(searchQuery);
        const matchText = item[language].substring(matchIndex, matchIndex + searchQuery.length);
        
        results.push({
          item,
          index,
          matchText
        });
      }
    });

    return results;
  }

  getItemsByChapter(chapter: string): ZakonItem[] {
    return this.zakonData.filter(item => item.chapter === chapter);
  }

  getItemsByChlan(chlan: string): ZakonItem[] {
    return this.zakonData.filter(item => item.chlan === chlan);
  }

  getItemsByParagraph(paragraph: string): ZakonItem[] {
    return this.zakonData.filter(item => item.paragraph === paragraph);
  }

  getItemByReference(chapter: string, chlan: string, paragraph: string): ZakonItem | undefined {
    return this.zakonData.find(item => 
      item.chapter === chapter && 
      item.chlan === chlan && 
      item.paragraph === paragraph
    );
  }

  generateLink(item: ZakonItem): string {
    const params = new URLSearchParams();
    if (item.chapter) params.set('chapter', item.chapter);
    if (item.chlan) params.set('chlan', item.chlan);
    if (item.paragraph) params.set('paragraph', item.paragraph);
    return `zakon?${params.toString()}`;
  }

  getChapters(): string[] {
    const chapters = new Set<string>();
    this.zakonData.forEach(item => {
      if (item.chapter) {
        chapters.add(item.chapter);
      }
    });
    return Array.from(chapters).sort();
  }
} 