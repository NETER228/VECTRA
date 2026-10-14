/* config.js — подключение к Supabase.
   publishable-ключ (sb_publishable_…) ПУБЛИЧНЫЙ: он безопасен только потому, что в базе включён RLS (см. supabase/schema.sql).
   Секретный ключ (sb_secret_…) сюда и вообще во фронтенд класть НЕЛЬЗЯ. */
window.VECTRA_CONFIG = {
  url: 'https://blmzkoaykwvyaqvaxduj.supabase.co',
  // куда уводим человека, если он не принял соглашение (поиск «конституция»)
  declineUrl: 'https://www.google.com/search?q=' + encodeURIComponent('конституция'),
  anonKey: 'sb_publishable_SfwMuTVeCHp-C3xaX_gKFw_p3Ad7O4G'
};
