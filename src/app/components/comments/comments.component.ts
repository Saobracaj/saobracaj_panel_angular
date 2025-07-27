import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AuthService, Comment } from '../../services/auth.service';

@Component({
  selector: 'app-comments',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatListModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './comments.component.html',
  styleUrl: './comments.component.scss'
})
export class CommentsComponent implements OnInit {
  comments: Comment[] = [];
  isLoading: boolean = true;
  error: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadComments();
  }

  loadComments(): void {
    this.isLoading = true;
    this.error = null;

    this.authService.getComments().subscribe({
      next: (comments) => {
        this.comments = comments;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Ошибка загрузки комментариев:', error);
        this.error = 'Ошибка загрузки комментариев';
        this.isLoading = false;
        
        // Если токен истек, попробуем обновить его
        if (error.graphQLErrors?.some((e: any) => e.extensions?.code === 'token_expired')) {
          this.refreshTokenAndRetry();
        } else {
          this.snackBar.open('Ошибка загрузки комментариев', 'Закрыть', {
            duration: 5000
          });
        }
      }
    });
  }

  private refreshTokenAndRetry(): void {
    this.authService.refreshToken().subscribe({
      next: () => {
        // Повторяем запрос после обновления токена
        this.loadComments();
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

  trackByCommentId(index: number, comment: Comment): string {
    return comment.id;
  }
} 