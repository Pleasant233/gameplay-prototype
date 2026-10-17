// 本机成就册：只保存最高进度和解锁记录，不保存对局或影响规则。
(function (root) {
  const D = typeof module !== 'undefined' && module.exports ? require('./data.js') : root.GameData;
  function create(storage) {
    const key = 'element-habitat.achievements.v1';
    let archive = { unlocked: [], progress: {} }, durable = !!storage;
    try {
      const value = JSON.parse(storage.getItem(key) || '{}');
      archive.unlocked = D.ACHIEVEMENTS.map(a => a.id).filter(id => Array.isArray(value.unlocked) && value.unlocked.includes(id));
      for (const a of D.ACHIEVEMENTS) {
        const n = value.progress && value.progress[a.id];
        if (Number.isFinite(n) && n >= 0) archive.progress[a.id] = Math.min(a.target, n);
      }
    } catch (_) { durable = false; }
    function observe(s, values) {
      const fresh = [];
      for (const a of D.ACHIEVEMENTS) {
        archive.progress[a.id] = Math.max(archive.progress[a.id] || 0, Math.min(a.target, values[a.metric] || 0));
        if (s.achievements.includes(a.id) && !archive.unlocked.includes(a.id)) { archive.unlocked.push(a.id); fresh.push(a.id); }
      }
      try { storage.setItem(key, JSON.stringify(archive)); durable = true; } catch (_) { durable = false; }
      return fresh;
    }
    return { observe, snapshot: () => JSON.parse(JSON.stringify(archive)), persistent: () => durable };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { create };
  else root.AchievementBook = { create };
})(this);
