// ================================================================
// Airflow OMS — Reconciliation 라우트 인덱스 (서브라우터 마운트)
// engine.ts + issues.ts
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { mountEngine } from './engine';
import { mountIssues } from './issues';

const reconciliation = new Hono<Env>();

mountEngine(reconciliation);
mountIssues(reconciliation);

export default reconciliation;
