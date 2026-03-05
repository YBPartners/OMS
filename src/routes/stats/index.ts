// ================================================================
// 와이비 OMS — Stats 라우트 인덱스 (서브라우터 마운트)
// dashboard.ts + reports.ts + policies.ts
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { mountDashboard } from './dashboard';
import { mountReports } from './reports';
import { mountPolicies } from './policies';

const stats = new Hono<Env>();

mountDashboard(stats);
mountReports(stats);
mountPolicies(stats);

export default stats;
