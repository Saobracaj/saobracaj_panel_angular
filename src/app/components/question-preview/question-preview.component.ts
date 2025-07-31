import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

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

@Component({
  selector: 'app-question-preview',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule
  ],
  templateUrl: './question-preview.component.html',
  styleUrl: './question-preview.component.scss'
})
export class QuestionPreviewComponent {
  @Input() question!: Question;
  @Input() russianTranslation?: RussianTranslation;

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const container = img.parentElement;
    if (container) {
      container.innerHTML = '<p class="image-error">Изображение недоступно</p>';
    }
  }

  onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.opacity = '1';
  }

  getRussianChoiceTranslation(choiceIndex: number): string | undefined {
    return this.russianTranslation?.Choices?.[choiceIndex]?.Text;
  }
} 