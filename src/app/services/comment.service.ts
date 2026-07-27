import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface CommentText {
  lang: string;
  text: string;
}

export interface CommentDraft {
  created: string;
  updated: string;
  text: CommentText[];
}

export interface CommentHistory {
  created: string;
  updated: string;
  text: CommentText[];
}

export interface InnerMessage {
  created: string;
  message: string;
  ownerId: string;
}

export interface CommentDetail {
  id: string;
  status: 'PENDING' | 'DRAFT' | 'MODERATION' | 'READY';
  draft?: CommentDraft;
  history: CommentHistory[];
  innerMessages: InnerMessage[];
  text: {
    created: string;
    updated: string;
    text: CommentText[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  constructor(private apollo: Apollo) {}

  getComment(id: string | number): Observable<CommentDetail> {
    console.log('CommentService: Запрашиваем комментарий с ID:', id);
    
    const GET_COMMENT_QUERY = gql`
      query Comment($id: Long!) {
        comment(id: $id) {
          id
          status
          draft {
            created
            updated
            text {
              lang
              text
            }
          }
          history {
            created
            updated
            text {
              lang
              text
            }
          }
          innerMessages {
            created
            message
            ownerId
          }
          text {
            created
            updated
            text {
              lang
              text
            }
          }
        }
      }
    `;

    return this.apollo.query<{ comment: CommentDetail }>({
      query: GET_COMMENT_QUERY,
      variables: { id: typeof id === 'string' ? parseInt(id, 10) : id }
    }).pipe(
      map(result => {
        console.log('CommentService: Получен ответ:', result);
        return result.data.comment;
      })
    );
  }

  saveDraft(id: string | number, draftText: string): Observable<CommentDetail> {
    const SAVE_DRAFT_MUTATION = gql`
      mutation Draft($id: Long!, $draft: String!) {
        draft(id: $id, draft: $draft) {
          id
          status
          draft {
            created
            updated
            text {
              lang
              text
            }
          }
          history {
            created
            updated
            text {
              lang
              text
            }
          }
          innerMessages {
            created
            message
            ownerId
          }
          text {
            created
            updated
            text {
              lang
              text
            }
          }
        }
      }
    `;

    return this.apollo.mutate<{ draft: CommentDetail }>({
      mutation: SAVE_DRAFT_MUTATION,
      variables: { id: typeof id === 'string' ? parseInt(id, 10) : id, draft: draftText }
    }).pipe(
      map(result => result.data!.draft)
    );
  }

  applyDraft(id: string | number): Observable<CommentDetail> {
    const APPLY_DRAFT_MUTATION = gql`
      mutation ApplyDraft($id: Long!) {
        applyDraft(id: $id) {
          id
          status
          draft {
            created
            updated
            text {
              lang
              text
            }
          }
          history {
            created
            updated
            text {
              lang
              text
            }
          }
          innerMessages {
            created
            message
            ownerId
          }
          text {
            created
            updated
            text {
              lang
              text
            }
          }
        }
      }
    `;

    return this.apollo.mutate<{ applyDraft: CommentDetail }>({
      mutation: APPLY_DRAFT_MUTATION,
      variables: { id: typeof id === 'string' ? parseInt(id, 10) : id }
    }).pipe(
      map(result => result.data!.applyDraft)
    );
  }

  setStatus(id: string | number, status: CommentDetail['status']): Observable<CommentDetail> {
    const SET_STATUS_MUTATION = gql`
      mutation SetStatus($id: Long!, $status: CommentStatus!) {
        setStatus(id: $id, status: $status) {
          id
          status
          draft {
            created
            updated
            text {
              lang
              text
            }
          }
          history {
            created
            updated
            text {
              lang
              text
            }
          }
          innerMessages {
            created
            message
            ownerId
          }
          text {
            created
            updated
            text {
              lang
              text
            }
          }
        }
      }
    `;

    return this.apollo.mutate<{ setStatus: CommentDetail }>({
      mutation: SET_STATUS_MUTATION,
      variables: { id: typeof id === 'string' ? parseInt(id, 10) : id, status }
    }).pipe(
      map(result => result.data!.setStatus)
    );
  }

  addInnerMessage(id: string | number, message: string): Observable<InnerMessage[]> {
    const ADD_INNER_MESSAGE_MUTATION = gql`
      mutation AddInnerMessage($id: Long!, $message: String!) {
        addInnerMessage(id: $id, message: $message) {
          created
          message
          ownerId
        }
      }
    `;

    return this.apollo.mutate<{ addInnerMessage: InnerMessage[] }>({
      mutation: ADD_INNER_MESSAGE_MUTATION,
      variables: { id: typeof id === 'string' ? parseInt(id, 10) : id, message }
    }).pipe(
      map(result => result.data!.addInnerMessage)
    );
  }
} 