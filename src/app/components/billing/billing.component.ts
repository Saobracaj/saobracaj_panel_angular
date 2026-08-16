import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  AuditEntry,
  BillingService,
  BillingUser,
  Order,
  OrderStatus,
  Tariff,
  TariffKind,
} from '../../services/billing.service';
import { AuthService } from '../../services/auth.service';

/**
 * Денежный стол оператора: входящие заказы, ручное подтверждение оплаты,
 * карточка пользователя с подпиской и журнал операций.
 *
 * На этой итерации подтверждение оплаты — единственный способ выдать подписку,
 * поэтому поиск идёт по позиву на број (его оператор видит в банковской
 * выписке) и по email.
 */
@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTabsModule,
    MatToolbarModule,
    MatTooltipModule,
  ],
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.scss',
})
export class BillingComponent implements OnInit {
  readonly pageSize = 50;

  // --- Заказы
  orders: Order[] = [];
  ordersTotal = 0;
  offset = 0;
  statusFilter: OrderStatus | '' = 'PENDING';
  search = '';
  loadingOrders = false;

  // --- Карточка пользователя
  userEmail = '';
  user: BillingUser | null = null;
  userNotFound = false;
  loadingUser = false;
  grantKind: TariffKind = 'BASIC';
  grantMonths = 12;
  grantNote = '';

  // --- Журнал и тарифы
  audit: AuditEntry[] = [];
  tariffs: Tariff[] = [];

  readonly statuses: { value: OrderStatus | ''; label: string }[] = [
    { value: '', label: 'Все' },
    { value: 'PENDING', label: 'Ожидает оплату' },
    { value: 'PAID', label: 'Оплачен' },
    { value: 'CANCELLED', label: 'Отменён' },
    { value: 'EXPIRED', label: 'Протух' },
  ];

  constructor(
    private billing: BillingService,
    private auth: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  // ------------------------------------------------------------------ заказы

  loadOrders(): void {
    this.loadingOrders = true;
    this.billing
      .orders(this.statusFilter || null, this.search.trim() || null, this.pageSize, this.offset)
      .subscribe({
        next: (page) => {
          this.orders = page.items;
          this.ordersTotal = page.total;
          this.loadingOrders = false;
        },
        error: (e) => {
          this.loadingOrders = false;
          this.fail('Не удалось загрузить заказы', e);
        },
      });
  }

  applyFilters(): void {
    this.offset = 0;
    this.loadOrders();
  }

  nextPage(): void {
    if (this.offset + this.pageSize >= this.ordersTotal) {
      return;
    }
    this.offset += this.pageSize;
    this.loadOrders();
  }

  prevPage(): void {
    if (this.offset === 0) {
      return;
    }
    this.offset = Math.max(0, this.offset - this.pageSize);
    this.loadOrders();
  }

  confirm(order: Order): void {
    // Операция с деньгами — подтверждаем намерение, случайный клик дорого стоит.
    const ok = confirm(
      `Подтвердить оплату заказа ${order.referenceDisplay} на ${order.amountRsd} RSD` +
        ` (${order.userEmail || order.userId})?\nПользователю будет выдана подписка и уйдёт письмо.`
    );
    if (!ok) {
      return;
    }
    this.billing.confirmOrder(order.id).subscribe({
      next: () => {
        this.ok('Оплата подтверждена, подписка выдана');
        this.loadOrders();
        this.refreshUserIfShown(order.userEmail);
      },
      error: (e) => this.fail('Не удалось подтвердить оплату', e),
    });
  }

  cancel(order: Order): void {
    const reason = prompt('Причина отмены заказа (необязательно):', '');
    if (reason === null) {
      return;
    }
    this.billing.cancelOrder(order.id, reason).subscribe({
      next: () => {
        this.ok('Заказ отменён');
        this.loadOrders();
      },
      error: (e) => this.fail('Не удалось отменить заказ', e),
    });
  }

  statusLabel(status: OrderStatus): string {
    return this.statuses.find((s) => s.value === status)?.label || status;
  }

  kindLabel(kind: TariffKind | null | undefined): string {
    if (!kind) {
      return '—';
    }
    return kind === 'RUSSIAN' ? 'с русским контентом' : 'базовый';
  }

  // --------------------------------------------------------- пользователь

  findUser(): void {
    const email = this.userEmail.trim();
    if (!email) {
      return;
    }
    this.loadingUser = true;
    this.userNotFound = false;
    this.billing.user(email).subscribe({
      next: (user) => {
        this.user = user;
        this.userNotFound = !user;
        this.loadingUser = false;
      },
      error: (e) => {
        this.loadingUser = false;
        this.fail('Не удалось загрузить пользователя', e);
      },
    });
  }

  grant(): void {
    if (!this.user) {
      return;
    }
    this.billing
      .grantSubscription(this.user.userId, this.grantKind, this.grantMonths, this.grantNote)
      .subscribe({
        next: () => {
          this.ok('Подписка выдана');
          this.grantNote = '';
          this.findUser();
        },
        error: (e) => this.fail('Не удалось выдать подписку', e),
      });
  }

  extend(): void {
    if (!this.user) {
      return;
    }
    this.billing.extendSubscription(this.user.userId, this.grantMonths, this.grantNote).subscribe({
      next: () => {
        this.ok('Подписка продлена');
        this.grantNote = '';
        this.findUser();
      },
      error: (e) => this.fail('Не удалось продлить подписку', e),
    });
  }

  revoke(): void {
    if (!this.user) {
      return;
    }
    if (!confirm(`Отозвать подписку у ${this.user.email}?`)) {
      return;
    }
    this.billing.revokeSubscription(this.user.userId, this.grantNote).subscribe({
      next: () => {
        this.ok('Подписка отозвана');
        this.grantNote = '';
        this.findUser();
      },
      error: (e) => this.fail('Не удалось отозвать подписку', e),
    });
  }

  private refreshUserIfShown(email: string | null | undefined): void {
    if (this.user && email && this.user.email === email) {
      this.findUser();
    }
  }

  // ------------------------------------------------------- журнал и тарифы

  loadAudit(): void {
    this.billing.auditLog(200).subscribe({
      next: (entries) => (this.audit = entries),
      error: (e) => this.fail('Не удалось загрузить журнал', e),
    });
  }

  loadTariffs(): void {
    this.billing.tariffs().subscribe({
      next: (tariffs) => (this.tariffs = tariffs),
      error: (e) => this.fail('Не удалось загрузить тарифы', e),
    });
  }

  savePrice(tariff: Tariff, raw: string): void {
    const price = parseInt(raw, 10);
    if (!Number.isFinite(price) || price <= 0 || price === tariff.priceRsd) {
      return;
    }
    this.billing.updateTariff(tariff.sku, price, null).subscribe({
      next: (updated) => {
        tariff.priceRsd = updated.priceRsd;
        this.ok(`Цена ${tariff.sku} обновлена`);
      },
      error: (e) => this.fail('Не удалось изменить цену', e),
    });
  }

  toggleActive(tariff: Tariff): void {
    this.billing.updateTariff(tariff.sku, null, !tariff.active).subscribe({
      next: (updated) => {
        tariff.active = updated.active;
        this.ok(updated.active ? 'Тариф показан в витрине' : 'Тариф скрыт из витрины');
      },
      error: (e) => this.fail('Не удалось изменить тариф', e),
    });
  }

  onTabChange(index: number): void {
    if (index === 2 && this.audit.length === 0) {
      this.loadAudit();
    }
    if (index === 3 && this.tariffs.length === 0) {
      this.loadTariffs();
    }
  }

  // ------------------------------------------------------------- служебное

  backToQuestions(): void {
    this.router.navigate(['/questions']);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  private ok(message: string): void {
    this.snackBar.open(message, 'OK', { duration: 3000 });
  }

  private fail(message: string, error: unknown): void {
    console.error(message, error);
    const detail = (error as { message?: string })?.message;
    this.snackBar.open(detail ? `${message}: ${detail}` : message, 'OK', { duration: 6000 });
  }
}
