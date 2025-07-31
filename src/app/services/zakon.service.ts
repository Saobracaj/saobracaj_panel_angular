import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
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

@Injectable({
  providedIn: 'root'
})
export class ZakonService {
  private zakonData: ZakonItem[] = [];
  private isLoaded = false;

  constructor(private http: HttpClient) {}

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