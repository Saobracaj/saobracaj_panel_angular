import { Directive, ElementRef, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';

@Directive({
  selector: '[appSimpleMDE]',
  standalone: true
})
export class SimpleMDEDirective implements OnInit, OnDestroy, OnChanges {
  @Input() value: string = '';
  @Input() options: any = {};
  @Output() valueChange = new EventEmitter<string>();
  @Output() change = new EventEmitter<string>();

  private simplemde: any = null;

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    this.initializeSimpleMDE();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && !changes['value'].firstChange && this.simplemde) {
      const currentValue = this.simplemde.value();
      if (currentValue !== this.value) {
        this.simplemde.value(this.value);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.simplemde) {
      this.simplemde.toTextArea();
      this.simplemde = null;
    }
  }

  private initializeSimpleMDE(): void {
    // Проверяем, что SimpleMDE загружен
    if (typeof window.SimpleMDE === 'undefined') {
      console.error('SimpleMDE не загружен');
      return;
    }

    const defaultOptions = {
      element: this.elementRef.nativeElement,
      spellChecker: false,
      autosave: {
        enabled: false
      },
      placeholder: 'Введите Markdown текст здесь...',
      toolbar: [
        'bold', 'italic', 'strikethrough', '|',
        'heading', 'code', 'quote', '|',
        'unordered-list', 'ordered-list', '|',
        'link', 'image', 'table', '|',
        'preview', 'side-by-side', 'fullscreen'
      ],
      status: ['lines', 'words'],
      minHeight: '400px',
      ...this.options
    };

    this.simplemde = new window.SimpleMDE(defaultOptions);

    // Устанавливаем начальное значение
    if (this.value) {
      this.simplemde.value(this.value);
    }

    // Слушаем изменения
    this.simplemde.codemirror.on('change', () => {
      const newValue = this.simplemde.value();
      this.valueChange.emit(newValue);
      this.change.emit(newValue);
    });
  }

  // Методы для внешнего доступа
  getValue(): string {
    return this.simplemde ? this.simplemde.value() : '';
  }

  setValue(value: string): void {
    if (this.simplemde) {
      this.simplemde.value(value);
    }
  }

  isPreviewActive(): boolean {
    return this.simplemde ? this.simplemde.isPreviewActive() : false;
  }

  isSideBySideActive(): boolean {
    return this.simplemde ? this.simplemde.isSideBySideActive() : false;
  }

  isFullscreenActive(): boolean {
    return this.simplemde ? this.simplemde.isFullscreenActive() : false;
  }
} 