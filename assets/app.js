/* ==========================================================================
   SNS AUTO 24 — app.js
   - KST 시계 · 자동 운영 콘솔 상태
   - 24시간 파이프라인 시뮬레이터 (시간대 / 채널)
   - 인스타그램 카드뉴스 캐러셀
   - 스크롤 리빌 · 카운터 · 영상 자동 재생
   외부 라이브러리 없음. file:// 에서도 동작.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- utils */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // 한국 시간(KST) 기준 현재 시각 — 브라우저 시간대와 무관하게 계산
  function kstNow() {
    var d = new Date();
    return new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 9 * 3600000);
  }
  function minutesOf(d) { return d.getHours() * 60 + d.getMinutes(); }
  function hhmm(min) {
    min = ((min % 1440) + 1440) % 1440;
    return pad(Math.floor(min / 60)) + ':' + pad(min % 60);
  }

  /* ---------------------------------------------------------------- icons */
  var ICON = {
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.2-.4-4.7a2.4 2.4 0 0 0-1.7-1.7C19.4 5.2 12 5.2 12 5.2s-7.4 0-8.9.4a2.4 2.4 0 0 0-1.7 1.7C1 8.8 1 12 1 12s0 3.2.4 4.7c.2.8.9 1.5 1.7 1.7 1.5.4 8.9.4 8.9.4s7.4 0 8.9-.4a2.4 2.4 0 0 0 1.7-1.7c.4-1.5.4-4.7.4-4.7Z"/><path d="M9.8 15.3V8.7L15.5 12l-5.7 3.3Z" fill="#0A1019"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/></svg>',
    threads: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="4"/><path d="M16 8v5.4a3 3 0 0 0 5.4 1.7A9 9 0 1 0 17.6 20"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3h-2.7v11.3a2.6 2.6 0 1 1-2.2-2.6V9a5.3 5.3 0 1 0 4.9 5.3V8.8a6.3 6.3 0 0 0 3.5 1.1V7.2a3.6 3.6 0 0 1-3.5-3.6V3Z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H7v3h3v7h3v-7h3l.4-3H13v-2c0-.6.4-1 1-1Z"/></svg>',
    naver: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm4 4v10h3.2v-5.2L14.8 17H18V7h-3.2v5.2L11.2 7H8Z"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    gov: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10 12 4l9 6M5 10v9h14v-9M9 19v-5h6v5"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.6 13.4 12 22l-9-9V4h9l8.6 8.6a1 1 0 0 1 0 1.4Z"/><circle cx="7.5" cy="8.5" r="1.6"/></svg>'
  };

  var CH = {
    youtube:   { name: '유튜브 쇼츠', handle: '@taxnote',    time: 9 * 60,  color: '#FF6B6B' },
    instagram: { name: '인스타그램', handle: '@taxnote.kr', time: 12 * 60, color: '#F2749D' },
    threads:   { name: '쓰레드',     handle: '@taxnote.kr', time: 15 * 60, color: '#EDF2F9' },
    tiktok:    { name: '틱톡',       handle: '@taxnote',    time: 9 * 60,  color: '#5AF3EE' },
    facebook:  { name: '페이스북',   handle: '세금 노트',    time: 12 * 60, color: '#7FA9FF' },
    naver:     { name: '네이버 블로그', handle: 'blog.naver.com/taxnote', time: 10 * 60, color: '#3DDC84' }
  };

  // 레일 배치상의 단계 위치(채널별 게시 단계)
  var CH_STAGE = { youtube: 2, tiktok: 2, naver: 3, instagram: 4, facebook: 4, threads: 5 };

  /* ------------------------------------------------------------- pipeline */
  var STAGES = [
    {
      hour: 6, short: '이슈 수집', kicker: '01 · COLLECT',
      title: '세무 이슈·트렌드 자동 수집',
      desc: '국세청·홈택스 개정 안내, 연말정산·종합소득세 일정, 업계 이슈를 검색해 오늘 다룰 소재 1건을 확정합니다. 아침 회의 없이도 주제가 정해져 있습니다.',
      bullets: [
        '국세청·홈택스 공지 및 개정 세법 스캔',
        '시즌 키워드(연말정산·부가세·종소세) 우선순위 정렬',
        '민감·금지 표현 필터 통과 후 소재 확정'
      ],
      outputs: ['소재 브리프 1건', '채널별 키워드 세트'],
      channels: [],
      human: '0분', extra: ['소재 확정', '06:00 자동', '6개']
    },
    {
      hour: 8, short: '원고·영상 생성', kicker: '02 · GENERATE',
      title: '쇼츠·카드뉴스·블로그·쓰레드 원고 동시 생성',
      desc: '확정된 소재 1건을 채널 포맷에 맞게 나눕니다. 쇼츠 스크립트와 세로 영상, 카드뉴스 5장 카피, 네이버 블로그 3,000자 원고와 본문 이미지 5장, 쓰레드 원고가 한 번에 만들어지고 브랜드 톤·금지어 규칙은 고정됩니다.',
      bullets: [
        '쇼츠 스크립트 + 세로 영상 1편',
        '카드뉴스 5장 카피와 해시태그',
        '네이버 블로그 원고 3,000자 + 본문 이미지 5장',
        '쓰레드 원고 1편 — 존댓말·정보형 톤 고정'
      ],
      outputs: ['쇼츠 영상', '카드뉴스 5장', '블로그 원고', '쓰레드 원고'],
      channels: ['youtube', 'instagram', 'naver', 'threads', 'tiktok', 'facebook'],
      human: '검토 5분 (선택)', extra: ['변환 규칙', '6개 포맷', '1소재']
    },
    {
      hour: 9, short: '쇼츠·틱톡 업로드', kicker: '03 · DISTRIBUTE',
      title: '유튜브 쇼츠 & 틱톡 자동 업로드',
      desc: '제작된 세로 영상 1편을 두 플랫폼 규격에 맞춰 올립니다. 썸네일·제목·설명·해시태그까지 세팅된 상태로 게시되고, 업로드 결과는 로그로 남습니다.',
      bullets: [
        '유튜브 쇼츠 09:00 게시 · 썸네일 자동 설정',
        '틱톡 09:00 게시 · 캡션·해시태그 적용',
        '업로드 실패 시 자동 재시도 후 담당자 알림'
      ],
      outputs: ['tax-shorts-10s-bgm.mp4', 'tax-shorts-thumbnail.png'],
      channels: ['youtube', 'tiktok'],
      human: '0분', extra: ['게시 시각', '09:00 자동', '2개 채널']
    },
    {
      hour: 10, short: '블로그 발행', kicker: '04 · DISTRIBUTE',
      title: '네이버 블로그 자동 발행',
      desc: '검색 키워드에 맞춘 3,000자 정보형 포스팅을 소제목·목차·본문 이미지 5장과 함께 발행합니다. 검색 유입이 많은 오전 시간에 맞춰 예약 발행되고, 발행 URL은 로그로 남습니다.',
      bullets: [
        '대표 키워드·연관 키워드 반영한 제목과 소제목 5개',
        '본문 3,000자 + 이미지 5장(1200×800) 자동 배치',
        '해시태그 11개 · 면책 문구 자동 삽입 후 발행'
      ],
      outputs: ['블로그 원고 3,022자', '본문 이미지 5장'],
      channels: ['naver'],
      human: '0분', extra: ['게시 시각', '10:00 자동', '1개 채널']
    },
    {
      hour: 12, short: '인스타·페이스북', kicker: '05 · DISTRIBUTE',
      title: '인스타그램 카드뉴스 & 페이스북 자동 업로드',
      desc: '카드뉴스 5장을 인스타그램 캐러셀로, 같은 소재를 페이스북 페이지에는 영상과 요약 글로 올립니다. 점심시간 트래픽에 맞춘 게시 시각입니다.',
      bullets: [
        '인스타그램: 카드뉴스 5장 캐러셀 + 해시태그 세팅',
        '페이스북: 릴스 영상 + 절세 꿀팁 요약 글',
        '게시 실패 시 자동 재시도 · 담당자 알림'
      ],
      outputs: ['카드뉴스 5장', '요약 글'],
      channels: ['instagram', 'facebook'],
      human: '0분', extra: ['게시 시각', '12:00 자동', '2개 채널']
    },
    {
      hour: 15, short: '쓰레드 업로드', kicker: '06 · DISTRIBUTE',
      title: '쓰레드 자동 업로드',
      desc: '원고를 쓰레드 말투로 다듬어 게시합니다. 링크 없이 읽히는 정보형 글이라 저장·공유가 남고, 프로필 방문으로 이어집니다.',
      bullets: [
        '쓰레드 원고 전체 게시',
        '해시태그·멘션 규칙 자동 적용',
        '게시 이력과 URL 로그 저장'
      ],
      outputs: ['쓰레드 원고 1편'],
      channels: ['threads'],
      human: '0분', extra: ['게시 시각', '15:00 자동', '1개 채널']
    },
    {
      hour: 22, short: '리포트·예약', kicker: '07 · REPORT',
      title: '반응 집계 & 다음 날 예약 완료',
      desc: '6개 채널의 노출·저장·프로필 방문을 한 장으로 모으고, 다음 날 06:00 소재 수집이 예약된 상태로 하루를 닫습니다. 사람은 숫자만 확인하면 됩니다.',
      bullets: [
        '채널별 반응 합산 리포트 1장',
        '다음 날 소재 후보 미리 저장',
        '06:00 수집 → 22:00 리포트 자동 순환'
      ],
      outputs: ['일일 리포트', '다음 날 예약'],
      channels: ['youtube', 'instagram', 'naver', 'threads', 'tiktok', 'facebook'],
      human: '확인 3분', extra: ['리포트', '22:00 자동', '6개 채널']
    }
  ];

  var CH_SPEC = {
    youtube: {
      flow: ['06:00 소재 반영', '08:00 세로 영상 변환', '09:00 자동 업로드', '22:00 반응 집계'],
      specs: [['형식', '세로 영상'], ['비율', '9:16'], ['길이', '10초'], ['자산', 'tax-shorts-10s-bgm.mp4']],
      preview: { type: 'tall', src: './assets/tax-shorts-thumbnail.png', cap: 'tax-shorts-thumbnail.png', right: '09:00 게시' }
    },
    instagram: {
      flow: ['06:00 소재 반영', '08:00 카드뉴스 5장 제작', '12:00 캐러셀 게시', '22:00 반응 집계'],
      specs: [['형식', '카드뉴스'], ['비율', '4:5'], ['장수', '5장'], ['자산', 'tax-insta-card-1~5.png']],
      preview: { type: 'card', src: './assets/tax-insta-card-1.png', cap: 'tax-insta-card-1.png', right: '12:00 게시' }
    },
    threads: {
      flow: ['06:00 소재 반영', '08:00 원고 작성', '15:00 자동 게시', '22:00 반응 집계'],
      specs: [['형식', '텍스트'], ['분량', '원고 1편'], ['톤', '정보형 존댓말'], ['자산', 'tax-threads-post.txt']],
      preview: { type: 'text', html: '<p><b>세금은 12월이 되면 갑자기 줄어들지 않습니다.</b></p><p style="margin-top:7px;color:#7A8BA1">사업용 카드와 계좌를 홈택스에 미리 등록해두면 경비 증빙이 자동으로 쌓입니다.</p>', cap: 'tax-threads-post.txt', right: '15:00 게시' }
    },
    tiktok: {
      flow: ['06:00 소재 반영', '08:00 규격 변환', '09:00 자동 업로드', '22:00 반응 집계'],
      specs: [['형식', '세로 영상'], ['비율', '9:16'], ['캡션', '해시태그 자동'], ['자산', 'tax-shorts-10s-bgm.mp4']],
      preview: { type: 'tall', src: './assets/tax-shorts-thumbnail.png', cap: 'tax-shorts-thumbnail.png', right: '09:00 업로드' }
    },
    naver: {
      flow: ['06:00 소재 반영', '08:00 블로그 원고·이미지 5장 생성', '10:00 예약 자동 발행', '22:00 반응 집계'],
      specs: [['형식', '정보형 포스팅'], ['분량', '3,022자'], ['이미지', '5장 · 1200×800'], ['자산', 'naver-blog-post.txt']],
      preview: { type: 'wide', src: './assets/blog/naver-blog-1.jpg', cap: 'naver-blog-1~5.jpg', right: '10:00 발행' }
    },
    facebook: {
      flow: ['06:00 소재 반영', '08:00 요약 글 작성', '12:00 릴스·글 게시', '22:00 반응 집계'],
      specs: [['형식', '릴스 + 텍스트'], ['비율', '9:16'], ['요약', '5줄'], ['자산', 'mp4 + 요약 글']],
      preview: { type: 'tall', src: './assets/tax-shorts-thumbnail.png', cap: 'tax-shorts-thumbnail.png', right: '12:00 게시' }
    }
  };

  var STAGE_PREVIEW = {
    0: {
      type: 'text',
      html: '<p><b>오늘의 소재</b> · 연말정산 전 반드시 점검할 경비 5가지</p>' +
            '<p style="margin-top:7px;color:#7A8BA1">국세청 공지 3건 · 시즌 키워드 12건 스캔 → 1건 확정</p>',
      cap: '소재 브리프', right: '확정'
    },
    1: { type: 'tall', src: './assets/tax-shorts-thumbnail.png', cap: 'tax-shorts-thumbnail.png', right: '변환 완료' },
    2: { type: 'tall', src: './assets/tax-shorts-thumbnail.png', cap: 'tax-shorts-10s-bgm.mp4', right: '업로드 완료' },
    3: { type: 'wide', src: './assets/blog/naver-blog-1.jpg', cap: 'naver-blog-post.txt · 이미지 5장', right: '발행 완료' },
    4: { type: 'card', src: './assets/tax-insta-card-1.png', cap: 'tax-insta-card-1~5.png', right: '게시 완료' },
    5: {
      type: 'text',
      html: '<p><b>세금은 12월이 되면 갑자기 줄어들지 않습니다.</b></p>' +
            '<p style="margin-top:7px;color:#7A8BA1">사업용 카드와 계좌를 홈택스에 미리 등록해두면 경비 증빙이 자동으로 쌓입니다. 놓치는 경비 1원도 없게요.</p>',
      cap: '원고 전체 게시', right: '15:00'
    },
    6: {
      type: 'text',
      html: '<p><b>일일 리포트</b> · 6개 채널 반응 합산</p>' +
            '<p style="margin-top:7px;color:#7A8BA1">노출 · 저장 · 프로필 방문 항목을 한 장으로 정리<br>다음 날 06:00 소재 수집 예약 완료</p>',
      cap: 'Daily report', right: '예약 완료'
    }
  };

  /* ------------------------------------------------------------ live clock */
  var elTime = $('#kTIME'), elStage = $('#kStage'), elNext = $('#kNext'), elGen = $('#kGen');
  var elLog = $('#kLog');
  var lastLog = '';

  function statusOf(min, nowMin) {
    if (nowMin < min) return 'wait';
    if (nowMin < min + 60) return 'now';
    return 'done';
  }

  function tickClock() {
    var d = kstNow();
    var nowMin = minutesOf(d);
    if (elTime) elTime.innerHTML = pad(d.getHours()) + ':' + pad(d.getMinutes()) +
      '<span style="font-size:12px;color:#8494A9;margin-left:6px;font-weight:500">KST</span>';

    // 다음 단계
    var next = null, prevMin = 0, nextShort = '';
    for (var i = 0; i < STAGES.length; i++) {
      var sm = STAGES[i].hour * 60;
      if (sm > nowMin) { next = { min: sm, title: STAGES[i].title }; nextShort = STAGES[i].short; break; }
      prevMin = sm;
    }
    if (!next) { next = { min: 6 * 60, title: STAGES[0].title }; nextShort = STAGES[0].short; }
    if (elStage) elStage.textContent = '다음 · ' + hhmm(next.min) + ' ' + nextShort;
    if (elNext) elNext.textContent = hhmm(next.min) + ' · ' + next.title;

    if (elGen) {
      var span = next.min - prevMin;
      var p = span > 0 ? Math.max(0, Math.min(100, ((nowMin - prevMin) / span) * 100)) : 0;
      elGen.style.width = p.toFixed(1) + '%';
    }

    // 채널 상태
    $$('.st-txt[data-ch]').forEach(function (el) {
      var key = el.getAttribute('data-ch');
      var st = statusOf(CH[key].time, nowMin);
      var map = { done: '업로드 완료', now: '업로드 중', wait: '예약' };
      el.className = 'st-txt st-txt--' + st;
      el.textContent = map[st];
    });

    if (elLog) {
      var lg = buildLog(nowMin);
      if (lg !== lastLog) { elLog.innerHTML = lg; lastLog = lg; }
    }
    updateRulerNow(nowMin);
  }

  function buildLog(nowMin) {
    var lines = STAGES.filter(function (s) { return s.hour * 60 <= nowMin; }).map(function (s) {
      return { t: pad(s.hour) + ':00', m: s.title };
    });
    if (!lines.length) {
      return '<span class="ln"><b>06:00</b> 오늘의 소재 수집 대기</span>';
    }
    var shown = lines.slice(-2);
    var html = shown.map(function (l) {
      return '<span class="ln"><b>' + l.t + '</b> ' + l.m + ' <em>완료</em></span>';
    }).join('');
    var nxt = STAGES.filter(function (s) { return s.hour * 60 > nowMin; })[0];
    if (nxt) html += '<span class="ln" style="opacity:.55">→ ' + pad(nxt.hour) + ':00 ' + nxt.title + ' 예약</span>';
    return html;
  }

  /* --------------------------------------------------- 24h ruler + rail */
  var rulerTicks = $('#rulerTicks'), rulerLabels = $('#rulerLabels'), rulerNow = $('#rulerNow');
  if (rulerTicks) {
    var t = '';
    for (var h = 0; h < 24; h++) t += '<i></i>';
    rulerTicks.innerHTML = t;
  }
  if (rulerLabels) {
    rulerLabels.innerHTML = [0, 6, 12, 18, 24].map(function (h) {
      var edge = h === 0 ? ' class="edge-l" style="left:6px"'
        : (h === 24 ? ' class="edge-r" style="left:calc(100% - 6px)"' : ' style="left:' + (h / 24 * 100) + '%"');
      return '<span' + edge + '>' + pad(h) + ':00</span>';
    }).join('') + STAGES.map(function (s) {
      return '<div class="ruler__stage" style="left:' + (s.hour / 24 * 100) + '%"></div>';
    }).join('');
  }
  function updateRulerNow(nowMin) {
    if (!rulerNow) return;
    rulerNow.style.left = (nowMin / 1440 * 100) + '%';
  }

  /* ------------------------------------------------------- simulator */
  var state = { mode: 'stage', stage: 3, channel: null, autoplay: false, timer: null };
  var rail = $('#rail'), detail = $('#detail'), detailMain = $('#detailMain'), detailSide = $('#detailSide');
  var railFill = $('#railFill');
  var nodes = $$('.node', rail || document);

  function nowStageIndex() {
    var nowMin = minutesOf(kstNow());
    var idx = 0;
    STAGES.forEach(function (s, i) { if (s.hour * 60 <= nowMin) idx = i; });
    return idx;
  }

  function previewHTML(p) {
    if (!p) return '';
    if (p.type === 'text') {
      return '<figure class="preview preview--text" style="margin:16px 0 0">' + p.html +
        '<figcaption style="position:static;background:none;padding:10px 0 0;border-top:1px solid rgba(232,238,247,.07);margin-top:10px">' +
        p.cap + ' <em style="color:#78E7BE;font-style:normal;font-weight:700;margin-left:auto">' + p.right + '</em></figcaption></figure>';
    }
    var cls = p.type === 'card' ? 'preview--card' : (p.type === 'wide' ? 'preview--wide' : 'preview--tall');
    return '<figure class="preview ' + cls + '" style="margin:16px 0 0">' +
      '<img src="' + p.src + '" alt="' + p.cap + ' 미리보기" loading="lazy">' +
      '<figcaption><span>' + p.cap + '</span><em>' + p.right + '</em></figcaption></figure>';
  }

  function renderStage(i) {
    var s = STAGES[i];
    var nowMin = minutesOf(kstNow());
    var html = '' +
      '<div class="detail__time">' + pad(s.hour) + ':00<span>KST</span></div>' +
      '<div class="detail__kicker">' + s.kicker + '</div>' +
      '<h3 class="detail__title">' + s.title + '</h3>' +
      '<p class="detail__desc">' + s.desc + '</p>' +
      '<ul class="detail__list">' + s.bullets.map(function (b) { return '<li>' + b + '</li>'; }).join('') + '</ul>' +
      '<div class="detail__out">' + s.outputs.map(function (o) { return '<span class="tag">산출물 <b>' + o + '</b></span>'; }).join('') + '</div>' +
      '<div class="detail__foot">' +
        '<div>사람 개입<b>' + s.human + '</b></div>' +
        '<div>' + s.extra[0] + '<b>' + s.extra[1] + '</b></div>' +
        '<div>채널<b>' + s.extra[2] + '</b></div>' +
      '</div>';
    detailMain.innerHTML = html;

    var rows = '';
    if (s.channels.length) {
      rows = s.channels.map(function (k) {
        var rel, cls;
        if (i <= 1) { cls = 'st-txt--done'; rel = '생성 완료'; }
        else if (CH[k].time < s.hour * 60) { cls = 'st-txt--done'; rel = '게시 완료'; }
        else if (CH[k].time === s.hour * 60) { cls = 'st-txt--now'; rel = '자동 게시 중'; }
        else { cls = 'st-txt--wait'; rel = '예약'; }
        return '<div class="side-row">' +
          '<span class="side-row__ico" style="color:' + CH[k].color + '">' + ICON[k] + '</span>' +
          '<span class="side-row__n"><b>' + CH[k].name + '</b><span>' + CH[k].handle + '</span></span>' +
          '<span class="side-row__m"><span class="st-txt ' + cls + '">' + rel + '</span></span>' +
          '</div>';
      }).join('');
    } else {
      rows = [['doc', '국세청 공지'], ['gov', '홈택스 개정 안내'], ['tag', '시즌 키워드']].map(function (row) {
        return '<div class="side-row">' +
          '<span class="side-row__ico" style="color:#F0B660">' + ICON[row[0]] + '</span>' +
          '<span class="side-row__n"><b>' + row[1] + '</b><span>자동 스캔</span></span>' +
          '<span class="side-row__m"><span class="st-txt st-txt--done">확인</span></span>' +
          '</div>';
      }).join('');
    }

    var pv = STAGE_PREVIEW[i];
    detailSide.innerHTML = '<div class="side__h"><b>' + (s.channels.length ? '채널 상태' : '수집 소스') +
      '</b><span class="badge ' + (s.channels.length ? 'badge--ok' : 'badge--wait') + '"><span class="dot"></span>' +
      (s.channels.length ? '자동 처리' : '스캔 완료') + '</span></div>' + rows + previewHTML(pv);
  }

  function renderChannel(k) {
    var c = CH[k], spec = CH_SPEC[k];
    var st = statusOf(c.time, minutesOf(kstNow()));
    var stTxt = st === 'done' ? '오늘 게시 완료' : (st === 'now' ? '게시 처리 중' : '게시 예약');
    var html = '' +
      '<div class="detail__time">' + hhmm(c.time) + '<span>KST</span></div>' +
      '<div class="detail__kicker" style="text-transform:none;letter-spacing:.1em">CHANNEL · ' + c.handle + '</div>' +
      '<h3 class="detail__title">' + c.name + ' 자동 운영 흐름</h3>' +
      '<p class="detail__desc">소재 1건이 ' + c.name + ' 규격으로 변환되어 예약 시각에 자동 게시됩니다. 게시 결과와 URL은 로그로 남고, 실패하면 재시도 후 담당자에게 알립니다.</p>' +
      '<ul class="detail__list">' + spec.flow.map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ul>' +
      '<div class="detail__foot" style="margin-top:auto">' +
        '<div>사람 개입<b>0분</b></div>' +
        '<div>게시 시각<b>' + hhmm(c.time) + ' 자동</b></div>' +
        '<div>오늘 상태<b>' + stTxt + '</b></div>' +
      '</div>';
    detailMain.innerHTML = html;

    detailSide.innerHTML = '<div class="side__h"><b>채널 사양</b><span class="badge badge--ok"><span class="dot"></span>자동 운영</span></div>' +
      spec.specs.map(function (sp) {
        return '<div class="side-row"><span class="side-row__n" style="flex:1"><b style="font-weight:600">' + sp[0] + '</b></span>' +
          '<span class="side-row__m" style="color:#D6E0EE">' + sp[1] + '</span></div>';
      }).join('') +
      previewHTML(spec.preview);
  }

  function highlight(i) {
    var dimSet = null;
    if (state.mode === 'channel') {
      dimSet = STAGES.map(function (s) { return s.channels.indexOf(state.channel) >= 0; });
    }
    nodes.forEach(function (n, idx) {
      var on;
      if (state.mode === 'channel') {
        on = dimSet[idx];
        n.classList.toggle('is-dim', !on);
      } else {
        on = idx === i;
        n.classList.remove('is-dim');
      }
      n.classList.toggle('is-active', on);
      n.setAttribute('aria-selected', (state.mode === 'stage' && on) ? 'true' : 'false');
    });
    if (railFill) {
      // 실제 노드 위치를 기준으로 진행선 폭을 맞춰 레이아웃이 바뀌어도 어긋나지 않게 한다
      var idx = state.mode === 'channel' ? CH_STAGE[state.channel] : i;
      var line = rail.querySelector('.rail__line');
      var dot = nodes[idx] ? nodes[idx].querySelector('.node__dot') : null;
      var firstDot = nodes[0] ? nodes[0].querySelector('.node__dot') : null;
      var lastDot = nodes[nodes.length - 1] ? nodes[nodes.length - 1].querySelector('.node__dot') : null;
      if (line && dot && firstDot && lastDot && window.innerWidth > 900) {
        var lr = rail.getBoundingClientRect();
        var fr = firstDot.getBoundingClientRect();
        var la = lastDot.getBoundingClientRect();
        line.style.left = (fr.left + fr.width / 2 - lr.left) + 'px';
        line.style.right = (lr.right - (la.left + la.width / 2)) + 'px';
        var d2 = dot.getBoundingClientRect();
        var w = (d2.left + d2.width / 2) - (fr.left + fr.width / 2);
        railFill.style.width = Math.max(0, Math.min(lr.width, w)) + 'px';
      }
    }
  }

  function setStage(i, fromUser) {
    state.mode = 'stage';
    state.stage = i;
    state.channel = null;
    $$('.chip').forEach(function (c) {
      var on = c.getAttribute('data-channel') === 'all';
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    highlight(i);
    renderStage(i);
    if (fromUser) stopAuto();
  }

  function setChannel(k) {
    state.mode = 'channel';
    state.channel = k;
    $$('.chip').forEach(function (c) {
      var on = c.getAttribute('data-channel') === k;
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    highlight(0);
    renderChannel(k);
    stopAuto();
  }

  function startAuto() {
    stopAuto();
    state.autoplay = true;
    setAutoBtn(true);
    state.timer = setInterval(function () {
      var next = state.mode === 'stage' ? (state.stage + 1) % STAGES.length : 0;
      state.mode = 'stage';
      state.stage = next;
      state.channel = null;
      $$('.chip').forEach(function (c) {
        var on = c.getAttribute('data-channel') === 'all';
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      highlight(next);
      renderStage(next);
    }, 4200);
  }
  function stopAuto() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (state.autoplay) { state.autoplay = false; setAutoBtn(false); }
  }
  function setAutoBtn(on) {
    var b = $('#playBtn');
    if (!b) return;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.querySelector('span').textContent = on ? '일시 정지' : '자동 재생';
    b.style.borderColor = on ? 'rgba(240,182,96,.5)' : '';
    b.style.color = on ? '#FFD79A' : '';
  }

  if (rail) {
    nodes.forEach(function (n, idx) {
      n.addEventListener('click', function () { setStage(idx, true); });
      n.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          var next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + STAGES.length) % STAGES.length;
          setStage(next, true);
          nodes[next].focus();
        }
      });
    });
    $$('.chip').forEach(function (c) {
      c.addEventListener('click', function () {
        var k = c.getAttribute('data-channel');
        if (k === 'all') setStage(nowStageIndex(), true);
        else setChannel(k);
      });
    });
    var playBtn = $('#playBtn');
    if (playBtn) {
      playBtn.addEventListener('click', function () {
        if (state.autoplay) stopAuto();
        else startAuto();
      });
    }
  }

  /* 초기 상태: 현재 시각 기준 단계 */
  if (detailMain) {
    setStage(nowStageIndex(), false);
  }

  tickClock();
  setInterval(tickClock, 1000);

  // 화면 폭이 바뀌면 진행선 위치를 다시 계산
  var rTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(rTimer);
    rTimer = setTimeout(function () { highlight(state.stage); }, 120);
  });

  /* ------------------------------------------------------ IG carousel */
  (function initCarousel() {
    var root = $('#igCarousel');
    if (!root) return;
    var slides = $('#igSlides');
    var prev = $('#igPrev'), next = $('#igNext');
    var dots = $$('#igDots button');
    var count = $('#igCount');
    var total = slides ? slides.children.length : 0;
    var idx = 0;

    function render() {
      slides.style.transform = 'translateX(' + (-idx * 100) + '%)';
      prev.disabled = idx === 0;
      next.disabled = idx === total - 1;
      if (count) count.textContent = (idx + 1) + ' / ' + total;
      dots.forEach(function (d, i) {
        d.classList.toggle('on', i === idx);
        d.setAttribute('aria-selected', i === idx ? 'true' : 'false');
      });
      // 보이지 않는 슬라이드는 접근성 트리에서 제외
      Array.prototype.forEach.call(slides.children, function (img, i) {
        img.setAttribute('aria-hidden', i === idx ? 'false' : 'true');
      });
    }
    function go(n) {
      idx = Math.max(0, Math.min(total - 1, n));
      render();
    }
    prev.addEventListener('click', function () { go(idx - 1); });
    next.addEventListener('click', function () { go(idx + 1); });
    dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); }); });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
    });

    // 스와이프
    var stage = root.querySelector('.js-stage');
    var startX = null;
    stage.addEventListener('pointerdown', function (e) { startX = e.clientX; });
    stage.addEventListener('pointerup', function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 38) go(idx + (dx < 0 ? 1 : -1));
    });
    stage.addEventListener('pointercancel', function () { startX = null; });
    render();
  })();

  /* ------------------------------------------------- naver blog gallery */
  (function initNaver() {
    var main = $('#nvMain'), cap = $('#nvCap');
    var thumbs = $$('#nvThumbs button'), outline = $$('#nvOutline button');
    if (!main || !thumbs.length) return;
    function show(i) {
      var t = thumbs[i - 1];
      main.src = './assets/blog/naver-blog-' + i + '.jpg';
      main.alt = '본문 이미지 ' + i + ' — ' + t.getAttribute('data-cap');
      if (cap) cap.textContent = '이미지 ' + i + ' / 5 · ' + t.getAttribute('data-cap');
      thumbs.forEach(function (b, k) {
        b.classList.toggle('on', k === i - 1);
        b.setAttribute('aria-pressed', k === i - 1 ? 'true' : 'false');
      });
      outline.forEach(function (b, k) { b.classList.toggle('on', k === i - 1); });
    }
    thumbs.concat(outline).forEach(function (b) {
      b.addEventListener('click', function () { show(parseInt(b.getAttribute('data-i'), 10)); });
    });
  })();

  /* ---------------------------------------------------------- reveal */
  (function initReveal() {
    var items = $$('.reveal');
    if (!items.length) return;
    if (!('IntersectionObserver' in window) || reduceMotion) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      $$('[data-count]').forEach(function (el) { el.firstChild.nodeValue = el.getAttribute('data-count'); });
      $$('[data-bar]').forEach(function (el) { el.style.width = el.getAttribute('data-bar') + '%'; });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        if (en.target.classList.contains('stat-grid')) {
          countUp(en.target);
        }
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  })();

  function countUp(root) {
    $$('[data-bar]', root).forEach(function (el) { el.style.width = el.getAttribute('data-bar') + '%'; });
    $$('[data-count]', root).forEach(function (el) {
      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      var em = el.querySelector('em');
      var start = performance.now();
      var dur = 1100;
      function step(now) {
        var p = Math.min(1, (now - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        var val = Math.round(target * eased);
        el.firstChild.nodeValue = String(val);
        if (p < 1) requestAnimationFrame(step);
        else el.firstChild.nodeValue = String(target);
      }
      requestAnimationFrame(step);
    });
  }

  /* ------------------------------------------------------- videos */
  (function initVideos() {
    var vids = $$('.js-video');
    if (!vids.length) return;
    vids.forEach(function (v) {
      v.addEventListener('pointerdown', function () { v.dataset.userPaused = '1'; });
      v.addEventListener('play', function () {
        if (!v.muted) { /* 사용자가 소리를 켠 경우 그대로 둔다 */ }
      });
    });
    if (!('IntersectionObserver' in window) || reduceMotion) return;

    var vo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting && en.intersectionRatio > 0.55 && !v.dataset.userPaused) {
          var p = v.play();
          if (p && p.catch) p.catch(function () { /* 자동 재생 차단 시 무시 */ });
        } else {
          if (!v.paused) v.pause();
        }
      });
    }, { threshold: [0, 0.55, 0.9] });
    vids.forEach(function (v) { vo.observe(v); });
  })();

  /* --------------------------------------------- header / progress */
  (function initHeader() {
    var header = $('#siteHeader');
    var bar = $('#progressBar');
    var navLinks = $$('.nav a');
    var sections = navLinks.map(function (a) { return document.querySelector(a.getAttribute('href')); });

    function onScroll() {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      if (header) header.classList.toggle('is-scrolled', y > 12);
      if (bar) {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
      }
      var active = -1;
      sections.forEach(function (s, i) {
        if (s && s.getBoundingClientRect().top <= 140) active = i;
      });
      navLinks.forEach(function (a, i) { a.classList.toggle('is-active', i === active); });
    }
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();

})();
