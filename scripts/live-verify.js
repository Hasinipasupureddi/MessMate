// Live verification script for MessMate dev server
const base = 'http://localhost:4028';
const fetch = global.fetch;

function extractCookie(setCookieHeader) {
  if (!setCookieHeader) return '';
  const raw = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  const pair = raw.split(';')[0];
  return pair;
}

async function postJson(path, body, cookie) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) { json = text; }
  return { status: res.status, headers: res.headers, body: json };
}

async function putJson(path, body, cookie) {
  const res = await fetch(base + path, {
    method: 'PUT',
    headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) { json = text; }
  return { status: res.status, headers: res.headers, body: json };
}

async function getJson(path, cookie) {
  const res = await fetch(base + path, {
    method: 'GET',
    headers: cookie ? { Cookie: cookie } : {},
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) { json = text; }
  return { status: res.status, headers: res.headers, body: json };
}

async function patchJson(path, body, cookie) {
  const res = await fetch(base + path, {
    method: 'PATCH',
    headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) { json = text; }
  return { status: res.status, headers: res.headers, body: json };
}

async function run() {
  console.log('--- Student flow ---');
  const signin = await postJson('/api/auth/signin', { email: 'arjun.mehta@messmate.in', password: 'Student@2026' });
  const cookie = extractCookie(signin.headers.get('set-cookie')) || '';
  console.log('signin status', signin.status, 'cookie', cookie ? 'OK' : 'MISSING');

  const votes = await putJson('/api/meal-votes', { votes: [
    { student_id: 'demo-student-1', vote_date: '2026-05-14', meal_type: 'breakfast', dish_option_id: 'vote-dosa', dish_name: 'Masala Dosa' },
    { student_id: 'demo-student-1', vote_date: '2026-05-14', meal_type: 'lunch', dish_option_id: 'vote-aloo', dish_name: 'Aloo Gobi Curry' },
  ] }, cookie);
  console.log('votes status', votes.status, JSON.stringify(votes.body));

  const rating = await putJson('/api/meal-ratings', { ratingDate: '2026-05-14', mealType: 'breakfast', dishName: 'Idly + Sambar', rating: 5, wasteAmount: 'none' }, cookie);
  console.log('rating status', rating.status, JSON.stringify(rating.body));

  const complaint = await postJson('/api/complaints', { category: 'Hygiene', complaintText: 'Dining hall floor very dirty after lunch.' }, cookie);
  console.log('complaint status', complaint.status, JSON.stringify(complaint.body));

  const leftovers = await getJson('/api/leftover-items?date=2026-05-14', cookie);
  console.log('leftovers list status', leftovers.status, JSON.stringify(leftovers.body));
  const first = leftovers.body?.rows?.[0]?.id;
  if (first) {
    const claim = await postJson('/api/leftover-claims', { leftoverId: first }, cookie);
    console.log('claim status', claim.status, JSON.stringify(claim.body));
  } else {
    console.log('no leftovers to claim');
  }

  console.log('\n--- Staff flow ---');
  const staffSignin = await postJson('/api/auth/signin', { email: 'raju.cook@messmate.in', password: 'Cook@2026' });
  const staffCookie = extractCookie(staffSignin.headers.get('set-cookie')) || '';
  console.log('staff signin', staffSignin.status, staffCookie ? 'OK' : 'MISSING');

  const patch = await patchJson('/api/cooking-tasks/task-003', { status: 'ready' }, staffCookie);
  console.log('patch cooking task', patch.status, JSON.stringify(patch.body));

  const ing = await getJson('/api/ingredients/calculate?headcount=210&buffer=10', staffCookie);
  console.log('ingredient calc', ing.status, JSON.stringify(ing.body && { calculation: ing.body.calculation }));

  console.log('\n--- Warden flow ---');
  const wardenSignin = await postJson('/api/auth/signin', { email: 'dr.sharma@messmate.in', password: 'Warden@2026' });
  const wardenCookie = extractCookie(wardenSignin.headers.get('set-cookie')) || '';
  console.log('warden signin', wardenSignin.status, wardenCookie ? 'OK' : 'MISSING');

  const kpis = await getJson('/api/warden/kpis?date=2026-05-14', wardenCookie);
  console.log('warden kpis', kpis.status, JSON.stringify(kpis.body));
}

run().catch(err => { console.error('LIVE VERIFY ERROR', err); process.exitCode = 2; });
