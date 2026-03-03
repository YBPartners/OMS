// ================================================================
// 다하다 OMS — HR 라우트 인덱스 (서브라우터 마운트)
// organizations.ts + users.ts + phone-verify.ts + commission.ts
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { mountOrganizations } from './organizations';
import { mountUsers } from './users';
import { mountPhoneVerify } from './phone-verify';
import { mountCommission } from './commission';

const hr = new Hono<Env>();

mountOrganizations(hr);
mountUsers(hr);
mountPhoneVerify(hr);
mountCommission(hr);

export default hr;
