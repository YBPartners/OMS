// ================================================================
// 다하다 OMS — Settlements 라우트 인덱스 (서브라우터 마운트)
// runs.ts + calculation.ts
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { mountRuns } from './runs';
import { mountCalculation } from './calculation';

const settlements = new Hono<Env>();

mountRuns(settlements);
mountCalculation(settlements);

export default settlements;
