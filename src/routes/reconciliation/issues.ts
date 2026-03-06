// ================================================================
// Airflow OMS — 대사 이슈 조회/해결
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { requireAuth } from '../../middleware/auth';

export function mountIssues(router: Hono<Env>) {

  // ─── 대사 Run 목록 ───
  router.get('/runs', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'AUDITOR']);
    if (authErr) return authErr;

    const result = await c.env.DB.prepare('SELECT * FROM reconciliation_runs ORDER BY started_at DESC').all();
    return c.json({ runs: result.results });
  });

  // ─── 대사 이슈 목록 ───
  router.get('/issues', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR', 'AUDITOR']);
    if (authErr) return authErr;

    const { run_id, type, severity, resolved, page = '1', limit = '50' } = c.req.query();
    const offset = (Number(page) - 1) * Number(limit);
    const conditions: string[] = [];
    const params: any[] = [];

    if (run_id) { conditions.push('ri.run_id = ?'); params.push(Number(run_id)); }
    if (type) { conditions.push('ri.type = ?'); params.push(type); }
    if (severity) { conditions.push('ri.severity = ?'); params.push(severity); }
    if (resolved === 'true') { conditions.push('ri.resolved_at IS NOT NULL'); }
    if (resolved === 'false') { conditions.push('ri.resolved_at IS NULL'); }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await c.env.DB.prepare(`
      SELECT ri.*, o.external_order_no, o.customer_name, o.status as order_status
      FROM reconciliation_issues ri
      LEFT JOIN orders o ON ri.order_id = o.order_id
      ${where}
      ORDER BY ri.severity DESC, ri.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, Number(limit), offset).all();

    const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM reconciliation_issues ri ${where}`).bind(...params).first();

    return c.json({ issues: result.results, total: (countResult as any)?.total || 0 });
  });

  // ─── 대사 이슈 해결 처리 ───
  router.patch('/issues/:issue_id/resolve', async (c) => {
    const authErr = requireAuth(c, ['SUPER_ADMIN', 'HQ_OPERATOR']);
    if (authErr) return authErr;

    const user = c.get('user')!;
    const issueId = Number(c.req.param('issue_id'));

    await c.env.DB.prepare(`
      UPDATE reconciliation_issues SET resolved_at = datetime('now'), resolver_id = ? WHERE issue_id = ?
    `).bind(user.user_id, issueId).run();

    return c.json({ ok: true });
  });
}
