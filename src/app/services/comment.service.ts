import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface CommentText {
  lang: string;
  text: string;
}

// Версионированный блок текста комментария: набор фрагментов по языкам
// (`items`) плюс таймстемпы создания/обновления в миллисекундах.
export interface CommentTextBlock {
  created: number;
  updated: number;
  items: CommentText[];
}

export interface CommentDetail {
  id: string;
  status: 'PENDING' | 'DRAFT' | 'MODERATION' | 'READY';
  draft?: CommentTextBlock;
  history: CommentTextBlock[];
  text?: CommentTextBlock;
}

// Общий набор полей комментария для всех запросов/мутаций.
const COMMENT_FIELDS = `
  id
  status
  draft {
    created
    updated
    items {
      lang
      text
    }
  }
  history {
    created
    updated
    items {
      lang
      text
    }
  }
  text {
    created
    updated
    items {
      lang
      text
    }
  }
`;

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  constructor(private apollo: Apollo) {}

  getComment(id: string | number): Observable<CommentDetail> {
    const GET_COMMENT_QUERY = gql`
      query QuestionComment($id: Int!) {
        questionComment(id: $id) {
          ${COMMENT_FIELDS}
        }
      }
    `;

    return this.apollo.query<{ questionComment: CommentDetail }>({
      query: GET_COMMENT_QUERY,
      variables: { id: typeof id === 'string' ? parseInt(id, 10) : id },
      fetchPolicy: 'network-only'
    }).pipe(
      map(result => result.data.questionComment)
    );
  }

  saveDraft(id: string | number, draftText: string): Observable<CommentDetail> {
    const SAVE_DRAFT_MUTATION = gql`
      mutation SaveCommentDraft($id: Int!, $draft: String!) {
        saveCommentDraft(id: $id, draft: $draft) {
          ${COMMENT_FIELDS}
        }
      }
    `;

    return this.apollo.mutate<{ saveCommentDraft: CommentDetail }>({
      mutation: SAVE_DRAFT_MUTATION,
      variables: { id: typeof id === 'string' ? parseInt(id, 10) : id, draft: draftText }
    }).pipe(
      map(result => result.data!.saveCommentDraft)
    );
  }

  applyDraft(id: string | number): Observable<CommentDetail> {
    const APPLY_DRAFT_MUTATION = gql`
      mutation ApplyCommentDraft($id: Int!) {
        applyCommentDraft(id: $id) {
          ${COMMENT_FIELDS}
        }
      }
    `;

    return this.apollo.mutate<{ applyCommentDraft: CommentDetail }>({
      mutation: APPLY_DRAFT_MUTATION,
      variables: { id: typeof id === 'string' ? parseInt(id, 10) : id }
    }).pipe(
      map(result => result.data!.applyCommentDraft)
    );
  }

  setStatus(id: string | number, status: CommentDetail['status']): Observable<CommentDetail> {
    const SET_STATUS_MUTATION = gql`
      mutation SetCommentStatus($id: Int!, $status: CommentStatus!) {
        setCommentStatus(id: $id, status: $status) {
          ${COMMENT_FIELDS}
        }
      }
    `;

    return this.apollo.mutate<{ setCommentStatus: CommentDetail }>({
      mutation: SET_STATUS_MUTATION,
      variables: { id: typeof id === 'string' ? parseInt(id, 10) : id, status }
    }).pipe(
      map(result => result.data!.setCommentStatus)
    );
  }
}
