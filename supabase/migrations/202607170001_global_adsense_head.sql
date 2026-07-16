insert into public.site_ads (
  slot,
  label,
  enabled,
  channel,
  link_url,
  image_url,
  alt_text,
  html_code
)
values (
  'global-head',
  '全站 AdSense 驗證碼',
  true,
  'html',
  '',
  '',
  'JapanNote AdSense',
  '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9349912323064571" crossorigin="anonymous"></script>'
)
on conflict (slot) do update
set
  label = excluded.label,
  channel = 'html',
  html_code = case
    when public.site_ads.html_code = '' then excluded.html_code
    else public.site_ads.html_code
  end;
