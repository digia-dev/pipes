async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  const res = await fetch('/api' + path, {
    ...opts,
    headers: { ...headers, ...opts.headers },
  });
  return res.json();
}
