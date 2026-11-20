// QRPass Manage Logs API client. Uses the same Bearer token as the existing QRPass API.
export type QRLogPeriod = 'today' | 'yesterday' | '7' | '30' | 'custom';
const configured = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const qrpassLogApiBase = configured ? (configured.endsWith('/api') ? configured : configured + '/api') : 'http://localhost:8000/api';
export async function qrpassManageLogsRequest(endpoint: string, method: 'GET'|'POST', payload?: Record<string,string>) {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('QRPass login token is missing. Log in again, then retry.');
  let url = `${qrpassLogApiBase}/sysadmin/manage-audit-logs/${endpoint}`;
  if (method === 'GET' && payload) url += '?' + new URLSearchParams(payload).toString();
  let res: Response;
  try { res = await fetch(url, {method, headers: {Authorization: `Bearer ${token}`, Accept:'application/json', ...(method==='POST'?{'Content-Type':'application/json'}:{})}, ...(method==='POST'?{body:JSON.stringify(payload||{})}:{})}); }
  catch { throw new Error(`Cannot reach Manage Logs API at ${qrpassLogApiBase}. Check Laravel server and VITE_API_URL.`); }
  if (!res.ok) {
    const body = await res.json().catch(()=>({}));
    const detail = typeof body.message === 'string' ? body.message : '';
    const hint = res.status===404 ? 'Verify the Manage Logs routes exist.' : res.status===401 ? 'Log in again.' : res.status===403 ? 'Check System Administrator permissions.' : '';
    throw new Error(`Manage Logs API HTTP ${res.status}: ${detail || hint || 'Request failed.'}`);
  }
  return res;
}
