// ================================================================
// 다하다 OMS — HR 라우트 인덱스 v7.0 (서브라우터 마운트)
// organizations + distributors + admin-regions + users +
// phone-verify + commission + channels + agency
// ================================================================
import { Hono } from 'hono';
import type { Env } from '../../types';
import { mountOrganizations } from './organizations';
import { mountDistributors } from './distributors';
import { mountAdminRegions } from './admin-regions';
import { mountUsers } from './users';
import { mountPhoneVerify } from './phone-verify';
import { mountCommission } from './commission';
import { mountChannels, mountAgency } from './channels-agency';

const hr = new Hono<Env>();

mountOrganizations(hr);
mountDistributors(hr);
mountAdminRegions(hr);
mountUsers(hr);
mountPhoneVerify(hr);
mountCommission(hr);
mountChannels(hr);
mountAgency(hr);

export default hr;
