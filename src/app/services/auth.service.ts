import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Comment {
  id: string;
  status: 'PENDING' | 'DRAFT' | 'MODERATION' | 'READY';
}

export interface CommentNotification {
  id: string;
  created: number;
  message: string;
  qId: number;
  read: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private apollo: Apollo) {
    // Проверяем наличие токенов при инициализации
    this.checkAuthStatus();
  }

  private checkAuthStatus(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (accessToken && refreshToken) {
        this.isAuthenticatedSubject.next(true);
      }
    }
  }

  login(email: string, password: string): Observable<AuthTokens> {
    const LOGIN_MUTATION = gql`
      query Auth($email: String!, $password: String!) {
        auth(email: $email, password: $password) {
          accessToken
          refreshToken
        }
      }
    `;

    return this.apollo.query<{ auth: AuthTokens }>({
      query: LOGIN_MUTATION,
      variables: { email, password }
    }).pipe(
      map(result => {
        const tokens = result.data.auth;
        this.saveTokens(tokens);
        this.isAuthenticatedSubject.next(true);
        return tokens;
      })
    );
  }

  refreshToken(): Observable<AuthTokens> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const REFRESH_MUTATION = gql`
      query RefreshToken($refreshToken: String!) {
        refreshToken(refreshToken: $refreshToken) {
          accessToken
          refreshToken
        }
      }
    `;

    return this.apollo.query<{ refreshToken: AuthTokens }>({
      query: REFRESH_MUTATION,
      variables: { refreshToken }
    }).pipe(
      map(result => {
        const tokens = result.data.refreshToken;
        this.saveTokens(tokens);
        return tokens;
      })
    );
  }

  getComments(): Observable<Comment[]> {
    const COMMENTS_QUERY = gql`
      query Comments {
        comments {
          id
          status
        }
      }
    `;

    return this.apollo.query<{ comments: Comment[] }>({
      query: COMMENTS_QUERY,
      fetchPolicy: 'network-only' // Принудительно загружаем с сервера
    }).pipe(
      map(result => {
        console.log('AuthService: Получено комментариев:', result.data.comments.length);
        if (result.data.comments.length > 0) {
          console.log('AuthService: Первые 3 комментария:', result.data.comments.slice(0, 3));
        } else {
          console.log('AuthService: Комментарии не найдены - возможно, они еще не созданы');
        }
        return result.data.comments;
      })
    );
  }

  getCommentNotifications(): Observable<CommentNotification[]> {
    const NOTIFICATIONS_QUERY = gql`
      query CommentNotifications {
        commentNotifications {
          created
          id
          message
          qId
          read
        }
      }
    `;

    return this.apollo.query<{ commentNotifications: CommentNotification[] }>({
      query: NOTIFICATIONS_QUERY,
      fetchPolicy: 'network-only' // Принудительно загружаем с сервера
    }).pipe(
      map(result => result.data.commentNotifications)
    );
  }

  readNotifications(lastReadTime: string | null): Observable<CommentNotification[]> {
    const READ_NOTIFICATIONS_MUTATION = gql`
      mutation ReadNotifications($lastReadTime: Long) {
        readNotifications(lastReadTime: $lastReadTime) {
          created
          id
          message
          qId
          read
        }
      }
    `;

    return this.apollo.mutate<{ readNotifications: CommentNotification[] }>({
      mutation: READ_NOTIFICATIONS_MUTATION,
      variables: { lastReadTime: lastReadTime ? parseInt(lastReadTime) : null }
    }).pipe(
      map(result => result.data!.readNotifications)
    );
  }

  private saveTokens(tokens: AuthTokens): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }
  }

  logout(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
    this.isAuthenticatedSubject.next(false);
  }

  getAccessToken(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('accessToken');
    }
    return null;
  }

  getRefreshToken(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('refreshToken');
    }
    return null;
  }
} 