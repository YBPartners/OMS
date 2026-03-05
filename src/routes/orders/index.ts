// ================================================================
// 와이비 OMS — Orders 라우트 인덱스 (서브라우터 마운트)
// crud.ts + distribute.ts + assign.ts + review.ts + report.ts
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { mountCrud } from './crud';
import { mountDistribute } from './distribute';
import { mountAssign } from './assign';
import { mountReview } from './review';
import { mountReport } from './report';

const orders = new Hono<Env>();

mountCrud(orders);
mountDistribute(orders);
mountAssign(orders);
mountReview(orders);
mountReport(orders);

export default orders;
