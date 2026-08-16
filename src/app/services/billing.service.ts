import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Статусы заказа — ровно те, что отдаёт бэкенд (`OrderStatus`).
export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
// Семейство тарифа: базовый или с русским контентом.
export type TariffKind = 'BASIC' | 'RUSSIAN';

export interface Order {
  id: string;
  userId: string;
  userEmail?: string | null;
  sku: string;
  tariffKind: TariffKind;
  months: number;
  amountRsd: number;
  status: OrderStatus;
  reference: string;
  referenceDisplay: string;
  createdAt: string;
  paymentDueAt: string;
  paidAt?: string | null;
  cancelledAt?: string | null;
}

export interface OrdersPage {
  items: Order[];
  total: number;
}

export interface SubscriptionStatus {
  active: boolean;
  tariffKind?: TariffKind | null;
  featureKeys: string[];
  endsAt?: string | null;
  daysLeft?: number | null;
  remindersEnabled: boolean;
}

export interface SubscriptionPeriod {
  id: string;
  featureKeys: string[];
  tariffKind?: TariffKind | null;
  startsAt: string;
  endsAt: string;
  source: 'ORDER' | 'MANUAL';
  orderId?: string | null;
  note?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export interface BillingUser {
  userId: string;
  email: string;
  subscription: SubscriptionStatus;
  periods: SubscriptionPeriod[];
  orders: Order[];
}

export interface AuditEntry {
  id: string;
  actorEmail?: string | null;
  action: string;
  userId?: string | null;
  orderId?: string | null;
  details?: string | null;
  createdAt: string;
}

export interface Tariff {
  sku: string;
  kind: TariffKind;
  months: number;
  priceRsd: number;
  featureKeys: string[];
  active: boolean;
  sortOrder: number;
}

const ORDER_FIELDS = `
  id
  userId
  userEmail
  sku
  tariffKind
  months
  amountRsd
  status
  reference
  referenceDisplay
  createdAt
  paymentDueAt
  paidAt
  cancelledAt
`;

const SUBSCRIPTION_FIELDS = `
  active
  tariffKind
  featureKeys
  endsAt
  daysLeft
  remindersEnabled
`;

const PERIOD_FIELDS = `
  id
  featureKeys
  tariffKind
  startsAt
  endsAt
  source
  orderId
  note
  revokedAt
  createdAt
`;

/**
 * Денежный стол: заказы, ручное подтверждение оплаты и операции с подпиской.
 * Всё под правом `manage_billing` на сервере — панель просто показывает ошибку,
 * если у оператора его нет.
 */
@Injectable({ providedIn: 'root' })
export class BillingService {
  constructor(private apollo: Apollo) {}

  orders(
    status: OrderStatus | null,
    search: string | null,
    limit: number,
    offset: number
  ): Observable<OrdersPage> {
    const QUERY = gql`
      query BillingOrders($status: OrderStatus, $search: String, $limit: Int!, $offset: Int!) {
        billingOrders(status: $status, search: $search, limit: $limit, offset: $offset) {
          items { ${ORDER_FIELDS} }
          total
        }
      }
    `;
    return this.apollo
      .query<{ billingOrders: OrdersPage }>({
        query: QUERY,
        variables: { status, search: search || null, limit, offset },
        fetchPolicy: 'network-only',
      })
      .pipe(map((r) => r.data.billingOrders));
  }

  user(email: string): Observable<BillingUser | null> {
    const QUERY = gql`
      query BillingUser($email: String!) {
        billingUser(email: $email) {
          userId
          email
          subscription { ${SUBSCRIPTION_FIELDS} }
          periods { ${PERIOD_FIELDS} }
          orders { ${ORDER_FIELDS} }
        }
      }
    `;
    return this.apollo
      .query<{ billingUser: BillingUser | null }>({
        query: QUERY,
        variables: { email },
        fetchPolicy: 'network-only',
      })
      .pipe(map((r) => r.data.billingUser));
  }

  auditLog(limit: number): Observable<AuditEntry[]> {
    const QUERY = gql`
      query BillingAuditLog($limit: Int!) {
        billingAuditLog(limit: $limit) {
          id
          actorEmail
          action
          userId
          orderId
          details
          createdAt
        }
      }
    `;
    return this.apollo
      .query<{ billingAuditLog: AuditEntry[] }>({
        query: QUERY,
        variables: { limit },
        fetchPolicy: 'network-only',
      })
      .pipe(map((r) => r.data.billingAuditLog));
  }

  tariffs(): Observable<Tariff[]> {
    const QUERY = gql`
      query AllTariffs {
        allTariffs { sku kind months priceRsd featureKeys active sortOrder }
      }
    `;
    return this.apollo
      .query<{ allTariffs: Tariff[] }>({ query: QUERY, fetchPolicy: 'network-only' })
      .pipe(map((r) => r.data.allTariffs));
  }

  confirmOrder(id: string): Observable<Order> {
    const MUTATION = gql`
      mutation ConfirmOrder($id: ID!) {
        confirmOrder(id: $id) { ${ORDER_FIELDS} }
      }
    `;
    return this.apollo
      .mutate<{ confirmOrder: Order }>({ mutation: MUTATION, variables: { id } })
      .pipe(map((r) => r.data!.confirmOrder));
  }

  cancelOrder(id: string, reason: string | null): Observable<Order> {
    const MUTATION = gql`
      mutation CancelOrder($id: ID!, $reason: String) {
        cancelOrder(id: $id, reason: $reason) { ${ORDER_FIELDS} }
      }
    `;
    return this.apollo
      .mutate<{ cancelOrder: Order }>({
        mutation: MUTATION,
        variables: { id, reason: reason || null },
      })
      .pipe(map((r) => r.data!.cancelOrder));
  }

  grantSubscription(
    userId: string,
    kind: TariffKind,
    months: number,
    note: string | null
  ): Observable<SubscriptionPeriod> {
    const MUTATION = gql`
      mutation GrantSubscription($userId: ID!, $kind: TariffKind!, $months: Int!, $note: String) {
        grantSubscription(userId: $userId, kind: $kind, months: $months, note: $note) {
          ${PERIOD_FIELDS}
        }
      }
    `;
    return this.apollo
      .mutate<{ grantSubscription: SubscriptionPeriod }>({
        mutation: MUTATION,
        variables: { userId, kind, months, note: note || null },
      })
      .pipe(map((r) => r.data!.grantSubscription));
  }

  extendSubscription(
    userId: string,
    months: number,
    note: string | null
  ): Observable<SubscriptionPeriod> {
    const MUTATION = gql`
      mutation ExtendSubscription($userId: ID!, $months: Int!, $note: String) {
        extendSubscription(userId: $userId, months: $months, note: $note) {
          ${PERIOD_FIELDS}
        }
      }
    `;
    return this.apollo
      .mutate<{ extendSubscription: SubscriptionPeriod }>({
        mutation: MUTATION,
        variables: { userId, months, note: note || null },
      })
      .pipe(map((r) => r.data!.extendSubscription));
  }

  revokeSubscription(userId: string, note: string | null): Observable<SubscriptionStatus> {
    const MUTATION = gql`
      mutation RevokeSubscription($userId: ID!, $note: String) {
        revokeSubscription(userId: $userId, note: $note) { ${SUBSCRIPTION_FIELDS} }
      }
    `;
    return this.apollo
      .mutate<{ revokeSubscription: SubscriptionStatus }>({
        mutation: MUTATION,
        variables: { userId, note: note || null },
      })
      .pipe(map((r) => r.data!.revokeSubscription));
  }

  updateTariff(sku: string, priceRsd: number | null, active: boolean | null): Observable<Tariff> {
    const MUTATION = gql`
      mutation UpdateTariff($sku: String!, $priceRsd: Int, $active: Boolean) {
        updateTariff(sku: $sku, priceRsd: $priceRsd, active: $active) {
          sku kind months priceRsd featureKeys active sortOrder
        }
      }
    `;
    return this.apollo
      .mutate<{ updateTariff: Tariff }>({
        mutation: MUTATION,
        variables: { sku, priceRsd, active },
      })
      .pipe(map((r) => r.data!.updateTariff));
  }
}
