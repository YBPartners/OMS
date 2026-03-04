// ================================================================
// 다하다 OMS — HR 라우트 인덱스 v5.0 (서브라우터 마운트)
// organizations + distributors + admin-regions + users +
// phone-verify + commission
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { mountOrganizations } from './organizations';
import { mountDistributors } from './distributors';
import { mountAdminRegions } from './admin-regions';
import { mountUsers } from './users';
import { mountPhoneVerify } from './phone-verify';
import { mountCommission } from './commission';

const hr = new Hono<Env>();

mountOrganizations(hr);
mountDistributors(hr);
mountAdminRegions(hr);
mountUsers(hr);
mountPhoneVerify(hr);
mountCommission(hr);

export default hr;
