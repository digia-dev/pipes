export default function (Alpine) {
  Alpine.magic('api', () => {
    return async (path, opts = {}) => {
      const headers = { 'Content-Type': 'application/json' };
      const token = Alpine.store('pipes').token;
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const res = await fetch('/api' + path, {
        ...opts,
        headers: { ...headers, ...opts.headers },
      });
      return res.json();
    };
  });
}
