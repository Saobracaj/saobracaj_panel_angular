import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Магазин, через который прошла оплата (`StorePlatform` бэкенда).
export type StorePlatform = 'APPLE' | 'GOOGLE';
// Состояние покупки по данным магазина (`StorePurchaseStatus`).
export type StorePurchaseStatus = 'ACTIVE' | 'EXPIRED' | 'REFUNDED';
export interface StorePurchase {
  id: string;
  userId: string;
  userEmail?: string | null;
  platform: StorePlatform;
  sku: string;
  months: number;
  productId: string;
  transactionId: string;
  subscriptionId?: string | null;
  autoRenewing: boolean;
  status: StorePurchaseStatus;
  purchasedAt: string;
  expiresAt?: string | null;
}

export interface StorePurchasesPage {
  items: StorePurchase[];
  total: number;
}

export interface SubscriptionStatus {
  active: boolean;
  featureKeys: string[];
  endsAt?: string | null;
  daysLeft?: number | null;
  autoRenewing: boolean;
  manageUrl?: string | null;
  platform?: StorePlatform | null;
  remindersEnabled: boolean;
}

export interface SubscriptionPeriod {
  id: string;
  featureKeys: string[];
  startsAt: string;
  endsAt: string;
  source: 'STORE' | 'MANUAL' | 'ORDER';
  purchaseId?: string | null;
  autoRenewing: boolean;
  note?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export interface BillingUser {
  userId: string;
  email: string;
  subscription: SubscriptionStatus;
  periods: SubscriptionPeriod[];
  purchases: StorePurchase[];
}

export interface AuditEntry {
  id: string;
  actorEmail?: string | null;
  action: string;
  userId?: string | null;
  purchaseId?: string | null;
  details?: string | null;
  createdAt: string;
}

export interface Tariff {
  sku: string;
  months: number;
  priceRsd: number;
  featureKeys: string[];
  appleProductId: string;
  googleProductId: string;
  autoRenewing: boolean;
  active: boolean;
  sortOrder: number;
}

const PURCHASE_FIELDS = `
  id
  userId
  userEmail
  platform
  sku
  months
  productId
  transactionId
  subscriptionId
  autoRenewing
  status
  purchasedAt
  expiresAt
`;

const SUBSCRIPTION_FIELDS = `
  active
  featureKeys
  endsAt
  daysLeft
  autoRenewing
  manageUrl
  platform
  remindersEnabled
`;

const PERIOD_FIELDS = `
  id
  featureKeys
  startsAt
  endsAt
  source
  purchaseId
  autoRenewing
  note
  revokedAt
  createdAt
`;

const TARIFF_FIELDS = `
  sku months priceRsd featureKeys appleProductId googleProductId
  autoRenewing active sortOrder
`;

/**
 * Денежный стол: покупки в сторах и операции с подпиской.
 *
 * Деньги берут App Store и Google Play, поэтому подтверждать оплату здесь
 * нечего: право появляется само по проверенному чеку. Оператору остались
 * наблюдение (покупки, журнал), ручная выдача подписки и правка каталога —
 * всё под правом `manage_billing` на сервере.
 */
@Injectable({ providedIn: 'root' })
export class BillingService {
  constructor(private apollo: Apollo) {}

  purchases(
    platform: StorePlatform | null,
    search: string | null,
    limit: number,
    offset: number
  ): Observable<StorePurchasesPage> {
    const QUERY = gql`
      query BillingPurchases($platform: StorePlatform, $search: String, $limit: Int!, $offset: Int!) {
        billingPurchases(platform: $platform, search: $search, limit: $limit, offset: $offset) {
          items { ${PURCHASE_FIELDS} }
          total
        }
      }
    `;
    return this.apollo
      .query<{ billingPurchases: StorePurchasesPage }>({
        query: QUERY,
        variables: { platform, search: search || null, limit, offset },
        fetchPolicy: 'network-only',
      })
      .pipe(map((r) => r.data.billingPurchases));
  }

  user(email: string): Observable<BillingUser | null> {
    const QUERY = gql`
      query BillingUser($email: String!) {
        billingUser(email: $email) {
          userId
          email
          subscription { ${SUBSCRIPTION_FIELDS} }
          periods { ${PERIOD_FIELDS} }
          purchases { ${PURCHASE_FIELDS} }
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
          purchaseId
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
        allTariffs { ${TARIFF_FIELDS} }
      }
    `;
    return this.apollo
      .query<{ allTariffs: Tariff[] }>({ query: QUERY, fetchPolicy: 'network-only' })
      .pipe(map((r) => r.data.allTariffs));
  }

  // Один тариф — Premium; выдаётся только срок.
  grantSubscription(
    userId: string,
    months: number,
    note: string | null
  ): Observable<SubscriptionPeriod> {
    const MUTATION = gql`
      mutation GrantSubscription($userId: ID!, $months: Int!, $note: String) {
        grantSubscription(userId: $userId, months: $months, note: $note) {
          ${PERIOD_FIELDS}
        }
      }
    `;
    return this.apollo
      .mutate<{ grantSubscription: SubscriptionPeriod }>({
        mutation: MUTATION,
        variables: { userId, months, note: note || null },
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
          ${TARIFF_FIELDS}
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
