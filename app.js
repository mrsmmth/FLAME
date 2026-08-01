(() => {
  'use strict';

  const STORAGE_KEY = 'frame-plot-v1';
  const VERSION = 1;
  const seasonMeta = {
    spring: { label: '春', icon: '🌸' },
    summer: { label: '夏', icon: '☀️' },
    autumn: { label: '秋', icon: '🍂' },
    winter: { label: '冬', icon: '❄️' }
  };
  const timeMeta = {
    morning: '朝',
    noon: '昼',
    night: '夜'
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));

  const defaultState = {
    version: VERSION,
    projectTitle: '新しい物語',
    atmosphere: { season: 'spring', time: 'morning' },
    references: [
      { id: uid(), type: 'cast', name: '主人公', spelling: 'PROTAGONIST', age: '28', role: '主人公', note: 'ここに執筆中ずっと確認したい人物情報を置く。' },
      { id: uid(), type: 'fact', label: '舞台', value: '物語の場所・時代・世界のルールなどを固定表示。' }
    ],
    chapters: [
      { id: uid(), title: '第1章', subtitle: '物語の入口', content: '冒頭で起きること、読者へ最初に渡す情報、人物の現在地を書く。', open: true },
      { id: uid(), title: '第2章', subtitle: '関係が動き始める', content: '', open: false },
      { id: uid(), title: '第3章', subtitle: '転換点', content: '', open: false }
    ]
  };

  let state = loadState();
  let saveTimer = null;
  let indicatorTimer = null;

  const els = {
    projectTitle: $('#projectTitle'),
    atmosphereButton: $('#atmosphereButton'),
    atmosphereIcon: $('#atmosphereIcon'),
    atmosphereLabel: $('#atmosphereLabel'),
    atmosphereDialog: $('#atmosphereDialog'),
    settingsDialog: $('#settingsDialog'),
    helpDialog: $('#helpDialog'),
    referenceDialog: $('#referenceDialog'),
    referenceForm: $('#referenceForm'),
    referenceType: $('#referenceType'),
    referenceId: $('#referenceId'),
    castFields: $('#castFields'),
    factFields: $('#factFields'),
    castList: $('#castList'),
    factList: $('#factList'),
    castCount: $('#castCount'),
    factCount: $('#factCount'),
    chapterList: $('#chapterList'),
    chapterTemplate: $('#chapterTemplate'),
    saveIndicator: $('#saveIndicator'),
    deleteReferenceButton: $('#deleteReferenceButton'),
    importInput: $('#importInput')
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(defaultState);
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') throw new Error('invalid data');
      return normalizeState(parsed);
    } catch (error) {
      console.warn('FRAME: failed to load saved data', error);
      return clone(defaultState);
    }
  }

  function normalizeState(input) {
    const normalized = {
      version: VERSION,
      projectTitle: typeof input.projectTitle === 'string' ? input.projectTitle : defaultState.projectTitle,
      atmosphere: {
        season: seasonMeta[input.atmosphere?.season] ? input.atmosphere.season : 'spring',
        time: timeMeta[input.atmosphere?.time] ? input.atmosphere.time : 'morning'
      },
      references: Array.isArray(input.references) ? input.references.filter(Boolean).map((item) => ({ ...item, id: item.id || uid() })) : [],
      chapters: Array.isArray(input.chapters) ? input.chapters.filter(Boolean).map((chapter, index) => ({
        id: chapter.id || uid(),
        title: typeof chapter.title === 'string' ? chapter.title : `第${index + 1}章`,
        subtitle: typeof chapter.subtitle === 'string' ? chapter.subtitle : '',
        content: typeof chapter.content === 'string' ? chapter.content : '',
        open: Boolean(chapter.open)
      })) : []
    };
    if (normalized.chapters.length === 0) normalized.chapters.push({ id: uid(), title: '第1章', subtitle: '', content: '', open: true });
    return normalized;
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 220);
  }

  function saveNow() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      showSaved();
    } catch (error) {
      console.error('FRAME: save failed', error);
    }
  }

  function showSaved() {
    clearTimeout(indicatorTimer);
    els.saveIndicator.classList.add('show');
    indicatorTimer = setTimeout(() => els.saveIndicator.classList.remove('show'), 900);
  }

  function applyAtmosphere() {
    const { season, time } = state.atmosphere;
    document.body.dataset.season = season;
    document.body.dataset.time = time;
    els.atmosphereIcon.textContent = seasonMeta[season].icon;
    els.atmosphereLabel.textContent = `${seasonMeta[season].label}・${timeMeta[time]}`;
    $$('[data-season-choice]').forEach((button) => button.classList.toggle('active', button.dataset.seasonChoice === season));
    $$('[data-time-choice]').forEach((button) => button.classList.toggle('active', button.dataset.timeChoice === time));
    renderParticles();
  }

  function renderParticles() {
    const holder = $('#particles');
    holder.replaceChildren();
    const count = window.matchMedia('(max-width: 760px)').matches ? 12 : 20;
    for (let i = 0; i < count; i += 1) {
      const p = document.createElement('i');
      p.className = 'particle';
      const size = state.atmosphere.season === 'winter' ? 2 + Math.random() * 4 : 2 + Math.random() * 3;
      p.style.width = `${size}px`;
      p.style.height = state.atmosphere.season === 'autumn' ? `${size * 1.8}px` : `${size}px`;
      p.style.left = `${Math.random() * 100}%`;
      p.style.top = `${-20 + Math.random() * 100}%`;
      p.style.setProperty('--drift-x', `${-90 + Math.random() * 180}px`);
      p.style.animationDuration = `${12 + Math.random() * 18}s`;
      p.style.animationDelay = `${-Math.random() * 24}s`;
      holder.appendChild(p);
    }
  }

  function renderReferences() {
    const cast = state.references.filter((item) => item.type === 'cast');
    const facts = state.references.filter((item) => item.type === 'fact');
    els.castCount.textContent = String(cast.length);
    els.factCount.textContent = String(facts.length);
    els.castList.replaceChildren(...(cast.length ? cast.map(makeCastCard) : [makeEmpty('人物を追加')])) ;
    els.factList.replaceChildren(...(facts.length ? facts.map(makeFactCard) : [makeEmpty('固定情報を追加')])) ;
  }

  function makeEmpty(text) {
    const div = document.createElement('div');
    div.className = 'empty-reference';
    div.textContent = text;
    return div;
  }

  function makeCastCard(item) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reference-card';
    button.dataset.referenceId = item.id;
    button.innerHTML = `
      <div class="cast-card-head">
        <span class="cast-name"></span>
        <span class="cast-age"></span>
      </div>
      <div class="cast-spelling"></div>
      <div class="cast-role"></div>
      <p class="card-note"></p>`;
    $('.cast-name', button).textContent = item.name || '名称未設定';
    $('.cast-age', button).textContent = item.age ? `${item.age} AGE` : '';
    $('.cast-spelling', button).textContent = item.spelling || '';
    const role = $('.cast-role', button);
    role.textContent = item.role || 'ROLE';
    role.hidden = !item.role;
    const note = $('.card-note', button);
    note.textContent = item.note || '';
    note.hidden = !item.note;
    button.addEventListener('click', () => openReferenceDialog(item.id));
    return button;
  }

  function makeFactCard(item) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reference-card';
    button.dataset.referenceId = item.id;
    const label = document.createElement('div');
    label.className = 'fact-label';
    label.textContent = item.label || 'ITEM';
    const value = document.createElement('p');
    value.className = 'fact-value';
    value.textContent = item.value || '';
    button.append(label, value);
    button.addEventListener('click', () => openReferenceDialog(item.id));
    return button;
  }

  function renderChapters() {
    els.chapterList.replaceChildren();
    state.chapters.forEach((chapter, index) => {
      const fragment = els.chapterTemplate.content.cloneNode(true);
      const card = $('.chapter-card', fragment);
      card.dataset.chapterId = chapter.id;
      card.classList.toggle('open', chapter.open);
      $('.chapter-index', card).textContent = String(index + 1).padStart(2, '0');
      const titleInput = $('.chapter-title-input', card);
      const subtitleInput = $('.chapter-subtitle-input', card);
      const content = $('.chapter-content', card);
      const count = $('.char-count', card);
      titleInput.value = chapter.title;
      subtitleInput.value = chapter.subtitle;
      content.value = chapter.content;
      count.textContent = String(chapter.content.length);

      $('.chapter-toggle', card).addEventListener('click', () => {
        chapter.open = !chapter.open;
        card.classList.toggle('open', chapter.open);
        scheduleSave();
        if (chapter.open) requestAnimationFrame(() => autoSizeTextarea(content));
      });

      titleInput.addEventListener('input', () => { chapter.title = titleInput.value; scheduleSave(); });
      subtitleInput.addEventListener('input', () => { chapter.subtitle = subtitleInput.value; scheduleSave(); });
      content.addEventListener('input', () => {
        chapter.content = content.value;
        count.textContent = String(chapter.content.length);
        autoSizeTextarea(content);
        scheduleSave();
      });

      const more = $('.chapter-more', card);
      const popover = $('.chapter-popover', card);
      more.addEventListener('click', (event) => {
        event.stopPropagation();
        closePopovers(popover);
        popover.hidden = !popover.hidden;
      });
      $$('[data-action]', popover).forEach((button) => button.addEventListener('click', () => {
        handleChapterAction(chapter.id, button.dataset.action);
        popover.hidden = true;
      }));

      els.chapterList.appendChild(fragment);
      if (chapter.open) requestAnimationFrame(() => autoSizeTextarea(content));
    });
  }

  function autoSizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 120), window.innerHeight * .55)}px`;
  }

  function closePopovers(except = null) {
    $$('.chapter-popover').forEach((popover) => {
      if (popover !== except) popover.hidden = true;
    });
  }

  function addChapter(afterIndex = state.chapters.length - 1) {
    const chapterNumber = state.chapters.length + 1;
    const chapter = { id: uid(), title: `第${chapterNumber}章`, subtitle: '', content: '', open: true };
    state.chapters.splice(afterIndex + 1, 0, chapter);
    renderChapters();
    scheduleSave();
    requestAnimationFrame(() => {
      const input = $(`[data-chapter-id="${CSS.escape(chapter.id)}"] .chapter-title-input`);
      input?.focus();
      input?.select();
    });
  }

  function handleChapterAction(id, action) {
    const index = state.chapters.findIndex((chapter) => chapter.id === id);
    if (index < 0) return;
    if (action === 'up' && index > 0) {
      [state.chapters[index - 1], state.chapters[index]] = [state.chapters[index], state.chapters[index - 1]];
    } else if (action === 'down' && index < state.chapters.length - 1) {
      [state.chapters[index + 1], state.chapters[index]] = [state.chapters[index], state.chapters[index + 1]];
    } else if (action === 'duplicate') {
      const copy = { ...clone(state.chapters[index]), id: uid(), title: `${state.chapters[index].title} コピー` };
      state.chapters.splice(index + 1, 0, copy);
    } else if (action === 'delete') {
      if (state.chapters.length === 1) {
        alert('章は最低1つ必要です。');
        return;
      }
      if (!confirm(`「${state.chapters[index].title || 'この章'}」を削除しますか？`)) return;
      state.chapters.splice(index, 1);
    } else {
      return;
    }
    renderChapters();
    scheduleSave();
  }

  function openReferenceDialog(id = null) {
    const item = id ? state.references.find((ref) => ref.id === id) : null;
    $('#referenceDialogTitle').textContent = item ? 'EDIT REFERENCE' : 'ADD REFERENCE';
    els.referenceId.value = item?.id || '';
    els.referenceType.value = item?.type || 'cast';
    $('#castName').value = item?.type === 'cast' ? item.name || '' : '';
    $('#castSpelling').value = item?.type === 'cast' ? item.spelling || '' : '';
    $('#castAge').value = item?.type === 'cast' ? item.age || '' : '';
    $('#castRole').value = item?.type === 'cast' ? item.role || '' : '';
    $('#castNote').value = item?.type === 'cast' ? item.note || '' : '';
    $('#factLabel').value = item?.type === 'fact' ? item.label || '' : '';
    $('#factValue').value = item?.type === 'fact' ? item.value || '' : '';
    els.deleteReferenceButton.hidden = !item;
    toggleReferenceFields();
    els.referenceDialog.showModal();
    setTimeout(() => (els.referenceType.value === 'cast' ? $('#castName') : $('#factLabel')).focus(), 80);
  }

  function toggleReferenceFields() {
    const isCast = els.referenceType.value === 'cast';
    els.castFields.hidden = !isCast;
    els.factFields.hidden = isCast;
  }

  function saveReference() {
    const type = els.referenceType.value;
    const id = els.referenceId.value;
    const existingIndex = state.references.findIndex((item) => item.id === id);
    const item = type === 'cast'
      ? {
          id: id || uid(), type,
          name: $('#castName').value.trim() || '名称未設定',
          spelling: $('#castSpelling').value.trim(),
          age: $('#castAge').value.trim(),
          role: $('#castRole').value.trim(),
          note: $('#castNote').value.trim()
        }
      : {
          id: id || uid(), type,
          label: $('#factLabel').value.trim() || 'ITEM',
          value: $('#factValue').value.trim()
        };
    if (existingIndex >= 0) state.references.splice(existingIndex, 1, item);
    else state.references.push(item);
    renderReferences();
    scheduleSave();
    els.referenceDialog.close();
  }

  function deleteReference() {
    const id = els.referenceId.value;
    const item = state.references.find((ref) => ref.id === id);
    if (!item) return;
    const title = item.type === 'cast' ? item.name : item.label;
    if (!confirm(`「${title || 'この項目'}」を削除しますか？`)) return;
    state.references = state.references.filter((ref) => ref.id !== id);
    renderReferences();
    scheduleSave();
    els.referenceDialog.close();
  }

  function setAllChapters(open) {
    state.chapters.forEach((chapter) => { chapter.open = open; });
    renderChapters();
    scheduleSave();
  }

  function exportData() {
    saveNow();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const safeName = (state.projectTitle || 'FRAME').replace(/[\\/:*?"<>|]/g, '_');
    a.href = URL.createObjectURL(blob);
    a.download = `${safeName}_FRAME.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importData(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      state = normalizeState(parsed);
      renderAll();
      saveNow();
      els.settingsDialog.close();
    } catch (error) {
      console.error(error);
      alert('FRAMEのJSONデータを読み込めませんでした。');
    } finally {
      els.importInput.value = '';
    }
  }

  function resetAll() {
    if (!confirm('FRAMEの全データを初期化しますか？')) return;
    if (!confirm('この操作は元に戻せません。本当に初期化しますか？')) return;
    state = clone(defaultState);
    renderAll();
    saveNow();
    els.settingsDialog.close();
  }

  function renderAll() {
    els.projectTitle.value = state.projectTitle;
    applyAtmosphere();
    renderReferences();
    renderChapters();
  }

  els.projectTitle.addEventListener('input', () => { state.projectTitle = els.projectTitle.value; scheduleSave(); });
  els.atmosphereButton.addEventListener('click', () => els.atmosphereDialog.showModal());
  $('#settingsButton').addEventListener('click', () => els.settingsDialog.showModal());
  $('#helpButton').addEventListener('click', () => els.helpDialog.showModal());
  $('#addReferenceButton').addEventListener('click', () => openReferenceDialog());
  els.referenceType.addEventListener('change', toggleReferenceFields);
  $('#saveReferenceButton').addEventListener('click', saveReference);
  els.deleteReferenceButton.addEventListener('click', deleteReference);
  $('#addChapterButton').addEventListener('click', () => addChapter());
  $('#bottomAddChapterButton').addEventListener('click', () => addChapter());
  $('#openAllButton').addEventListener('click', () => setAllChapters(true));
  $('#closeAllButton').addEventListener('click', () => setAllChapters(false));
  $('#exportButton').addEventListener('click', exportData);
  els.importInput.addEventListener('change', () => importData(els.importInput.files?.[0]));
  $('#clearButton').addEventListener('click', resetAll);

  $$('[data-season-choice]').forEach((button) => button.addEventListener('click', () => {
    state.atmosphere.season = button.dataset.seasonChoice;
    applyAtmosphere();
    scheduleSave();
  }));
  $$('[data-time-choice]').forEach((button) => button.addEventListener('click', () => {
    state.atmosphere.time = button.dataset.timeChoice;
    applyAtmosphere();
    scheduleSave();
  }));

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.chapter-menu')) closePopovers();
  });
  window.addEventListener('resize', () => {
    $$('.chapter-card.open .chapter-content').forEach(autoSizeTextarea);
  });
  window.addEventListener('beforeunload', saveNow);

  renderAll();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js?v=01').catch((error) => console.warn('FRAME SW', error)));
  }
})();
