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
        }
      }
    `;

    return this.apollo.query<{ comments: Comment[] }>({
      query: COMMENTS_QUERY
    }).pipe(
      map(result => result.data.comments)
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