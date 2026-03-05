// ================================================================
// 와이비 OMS — D1 Batch Transaction Builder v5.0
// Cloudflare D1의 batch() API를 사용한 원자적 다중 쿼리 실행
// 기존: 정산 시 개별 INSERT 6회 × N건 → 네트워크 왕복 60+회
// 혁신: BatchBuilder로 1회 batch() 호출 (−98% DB 호출)
// ================================================================

/**
 * D1PreparedStatement를 흉내내는 래퍼 (batch에 넘길 용도)
 */
interface BatchItem {
  sql: string;
  binds: any[];
}

/**
 * BatchBuilder — D1 batch 실행기
 * 
 * @example
 * ```ts
 * const batch = new BatchBuilder(db);
 * batch.add('INSERT INTO orders ...', [val1, val2]);
 * batch.add('UPDATE settlements SET ...', [val3]);
 * batch.add('INSERT INTO audit_logs ...', [val4]);
 * const results = await batch.execute();
 * ```
 * 
 * D1의 batch()는 단일 트랜잭션으로 실행되므로
 * 하나라도 실패하면 전체 롤백된다.
 */
export class BatchBuilder {
  private db: D1Database;
  private items: BatchItem[] = [];
  private _label: string = '';

  constructor(db: D1Database) {
    this.db = db;
  }

  /** 배치에 라벨 부여 (로그용) */
  label(name: string): BatchBuilder {
    this._label = name;
    return this;
  }

  /** SQL 문 추가 */
  add(sql: string, binds: any[] = []): BatchBuilder {
    this.items.push({ sql, binds });
    return this;
  }

  /** 조건부 SQL 문 추가 */
  addIf(condition: boolean, sql: string, binds: any[] = []): BatchBuilder {
    if (condition) {
      this.items.push({ sql, binds });
    }
    return this;
  }

  /** 배열 항목을 개별 INSERT로 추가 */
  addMany<T>(items: T[], sqlFn: (item: T) => { sql: string; binds: any[] }): BatchBuilder {
    for (const item of items) {
      const { sql, binds } = sqlFn(item);
      this.items.push({ sql, binds });
    }
    return this;
  }

  /** 현재 배치 아이템 수 */
  get size(): number {
    return this.items.length;
  }

  /** 배치가 비어있는지 */
  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  /** 배치 실행 (D1 batch API — 원자적 트랜잭션) */
  async execute(): Promise<D1Result[]> {
    if (this.items.length === 0) {
      return [];
    }

    const statements = this.items.map(item => {
      return this.db.prepare(item.sql).bind(...item.binds);
    });

    try {
      const results = await this.db.batch(statements);
      return results;
    } catch (error: any) {
      console.error(`[BatchBuilder:${this._label || 'unnamed'}] Batch execution failed:`, error.message);
      throw new Error(`배치 트랜잭션 실패${this._label ? ` (${this._label})` : ''}: ${error.message}`);
    }
  }

  /** 배치 내용 초기화 */
  clear(): BatchBuilder {
    this.items = [];
    return this;
  }

  /** 디버그용: 현재 배치 내용 출력 */
  debug(): { label: string; size: number; items: { sql: string; bindCount: number }[] } {
    return {
      label: this._label || 'unnamed',
      size: this.items.length,
      items: this.items.map(i => ({ sql: i.sql.substring(0, 100) + '...', bindCount: i.binds.length })),
    };
  }
}

// ================================================================
// 정산 배치 헬퍼 — 정산 계산 시 사용하는 특화 빌더
// ================================================================

export interface SettlementItem {
  orderId: number;
  teamLeaderId: number;
  teamOrgId?: number;
  regionOrgId: number;
  baseAmount: number;
  commissionMode: CommissionMode;
  commissionRate: number;
  commissionAmount: number;
  payableAmount: number;
  periodType: string;
  periodStart: string;
  periodEnd: string;
}

import type { CommissionMode } from '../types';

/**
 * buildSettlementBatch — 정산 명세를 원자적으로 생성
 * 
 * 기존: for문으로 개별 INSERT → N번 네트워크 왕복
 * 혁신: BatchBuilder로 1회 실행 → DB 호출 1회
 */
export function buildSettlementBatch(
  db: D1Database,
  runId: number,
  items: SettlementItem[],
  confirmedBy?: number
): BatchBuilder {
  const batch = new BatchBuilder(db).label(`settlement-run-${runId}`);

  for (const item of items) {
    batch.add(
      `INSERT INTO settlements (
        run_id, order_id, team_leader_id, team_org_id, region_org_id,
        base_amount, commission_mode, commission_rate, commission_amount, payable_amount,
        period_type, period_start, period_end, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        runId, item.orderId, item.teamLeaderId, item.teamOrgId || null, item.regionOrgId,
        item.baseAmount, item.commissionMode, item.commissionRate,
        item.commissionAmount, item.payableAmount,
        item.periodType, item.periodStart, item.periodEnd,
      ]
    );
  }

  // 실행 요약 업데이트
  const totalBase = items.reduce((s, i) => s + i.baseAmount, 0);
  const totalCommission = items.reduce((s, i) => s + i.commissionAmount, 0);
  const totalPayable = items.reduce((s, i) => s + i.payableAmount, 0);

  batch.add(
    `UPDATE settlement_runs SET 
      total_base_amount = ?, total_commission_amount = ?, total_payable_amount = ?,
      total_count = ?, status = 'CALCULATED', updated_at = datetime('now')
    WHERE run_id = ?`,
    [totalBase, totalCommission, totalPayable, items.length, runId]
  );

  return batch;
}
