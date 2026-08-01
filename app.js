(() => {
  'use strict';

  const STORAGE_KEY = 'frame-plot-v1';
  const VERSION = 2;
  const seasonMeta = {
    spring: { label: '春', icon: '🌸' },
    summer: { label: '夏', icon: '☀️' },
    autumn: { label: '秋', icon: '🍂' },
    winter: { label: '冬', icon: '❄️' }
  };
  const timeMeta = { morning: '朝', noon: '昼', night: '夜' };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const now = () => Date.now();

  function makeBlankWork(title = '新しい物語') {
    const timestamp = now();
    return {
      id: uid(),
      projectTitle: title,
      createdAt: timestamp,
      updatedAt: timestamp,
      atmosphere: { season: 'spring', time: 'morning' },
      references: [],
      chapters: [
        { id: uid(), title: '第1章', subtitle: '', content: '', open: true }
      ]
    };
  }

  function makeStarterWork() {
    const work = makeBlankWork('新しい物語');
    work.references = [
      { id: uid(), type: 'cast', name: '主人公', spelling: 'PROTAGONIST', age: '28', role: '主人公', note: 'ここに執筆中ずっと確認したい人物情報を置く。' },
      { id: uid(), type: 'fact', label: '舞台', value: '物語の場所・時代・世界のルールなどを固定表示。' }
    ];
    work.chapters = [
      { id: uid(), title: '第1章', subtitle: '物語の入口', content: '冒頭で起きること、読者へ最初に渡す情報、人物の現在地を書く。', open: true },
      { id: uid(), title: '第2章', subtitle: '関係が動き始める', content: '', open: false },
      { id: uid(), title: '第3章', subtitle: '転換点', content: '', open: false }
    ];
    return work;
  }

  function makeDefaultLibrary() {
    return {
      version: VERSION,
      activeWorkId: null,
      sortMode: 'updated',
      works: [makeStarterWork()]
    };
  }

  let state = loadState();
  let currentView = 'library';
  let saveTimer = null;
  let indicatorTimer = null;

  const els = {
    libraryView: $('#libraryView'),
    editorView: $('#editorView'),
    workGrid: $('#workGrid'),
    workCount: $('#workCount'),
    workSearchInput: $('#workSearchInput'),
    workSortSelect: $('#workSortSelect'),
    workCardTemplate: $('#workCardTemplate'),
    workDialog: $('#workDialog'),
    newWorkTitle: $('#newWorkTitle'),
    newWorkMode: $('#newWorkMode'),
    duplicateSourceField: $('#duplicateSourceField'),
    duplicateSourceSelect: $('#duplicateSourceSelect'),
    projectTitle: $('#projectTitle'),
    atmosphereButton: $('#atmosphereButton'),
    atmosphereIcon: $('#atmosphereIcon'),
    atmosphereLabel: $('#atmosphereLabel'),
    atmosphereDialog: $('#atmosphereDialog'),
    settingsDialog: $('#settingsDialog'),
    helpDialog: $('#helpDialog'),
    referenceDialog: $('#referenceDialog'),
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
      if (!raw) return makeDefaultLibrary();
      const parsed = JSON.parse(raw);
      return normalizeLibrary(parsed);
    } catch (error) {
      console.warn('FRAME: failed to load saved data', error);
      return makeDefaultLibrary();
    }
  }

  function normalizeLibrary(input) {
    if (input && Array.isArray(input.works)) {
      return {
        version: VERSION,
        activeWorkId: null,
        sortMode: ['updated', 'title', 'manual'].includes(input.sortMode) ? input.sortMode : 'updated',
        works: input.works.filter(Boolean).map((work, index) => normalizeWork(work, `作品 ${index + 1}`))
      };
    }

    if (looksLikeWork(input)) {
      const migrated = normalizeWork(input, input.projectTitle || '新しい物語');
      return { version: VERSION, activeWorkId: null, sortMode: 'updated', works: [migrated] };
    }

    return makeDefaultLibrary();
  }

  function looksLikeWork(value) {
    return Boolean(value && typeof value === 'object' && (Array.isArray(value.chapters) || Array.isArray(value.references) || typeof value.projectTitle === 'string'));
  }

  function normalizeWork(input, fallbackTitle = '新しい物語') {
    const timestamp = Number(input?.updatedAt) || now();
    const references = Array.isArray(input?.references)
      ? input.references.filter(Boolean).map((item) => normalizeReference(item)).filter(Boolean)
      : [];
    const chapters = Array.isArray(input?.chapters)
      ? input.chapters.filter(Boolean).map((chapter, index) => normalizeChapter(chapter, index))
      : [];

    if (chapters.length === 0) chapters.push({ id: uid(), title: '第1章', subtitle: '', content: '', open: true });

    return {
      id: input?.id || uid(),
      projectTitle: typeof input?.projectTitle === 'string' && input.projectTitle.trim() ? input.projectTitle : fallbackTitle,
      createdAt: Number(input?.createdAt) || timestamp,
      updatedAt: timestamp,
      atmosphere: {
        season: seasonMeta[input?.atmosphere?.season] ? input.atmosphere.season : 'spring',
        time: timeMeta[input?.atmosphere?.time] ? input.atmosphere.time : 'morning'
      },
      references,
      chapters
    };
  }

  function normalizeReference(item) {
    if (item?.type === 'fact') {
      return {
        id: item.id || uid(),
        type: 'fact',
        label: typeof item.label === 'string' ? item.label : 'ITEM',
        value: typeof item.value === 'string' ? item.value : ''
      };
    }
    if (item?.type === 'cast' || item?.name || item?.role) {
      return {
        id: item.id || uid(),
        type: 'cast',
        name: typeof item.name === 'string' ? item.name : '名称未設定',
        spelling: typeof item.spelling === 'string' ? item.spelling : '',
        age: typeof item.age === 'string' ? item.age : String(item.age ?? ''),
        role: typeof item.role === 'string' ? item.role : '',
        note: typeof item.note === 'string' ? item.note : ''
      };
    }
    return null;
  }

  function normalizeChapter(chapter, index) {
    return {
      id: chapter.id || uid(),
      title: typeof chapter.title === 'string' ? chapter.title : `第${index + 1}章`,
      subtitle: typeof chapter.subtitle === 'string' ? chapter.subtitle : '',
      content: typeof chapter.content === 'string' ? chapter.content : '',
      open: Boolean(chapter.open)
    };
  }

  function currentWork() {
    return state.works.find((work) => work.id === state.activeWorkId) || null;
  }

  function scheduleSave(show = true) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNow(show), 220);
  }

  function saveNow(show = true) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (show) showSaved();
    } catch (error) {
      console.error('FRAME: save failed', error);
    }
  }

  function touchWork(work = currentWork()) {
    if (work) work.updatedAt = now();
    scheduleSave();
  }

  function showSaved() {
    clearTimeout(indicatorTimer);
    els.saveIndicator.classList.add('show');
    indicatorTimer = setTimeout(() => els.saveIndicator.classList.remove('show'), 900);
  }

  function setView(view) {
    currentView = view;
    const isLibrary = view === 'library';
    els.libraryView.hidden = !isLibrary;
    els.editorView.hidden = isLibrary;
    document.body.dataset.view = view;
    closePopovers();
    if (isLibrary) {
      renderLibrary();
      renderParticles();
    } else {
      renderEditor();
    }
  }

  function openWork(id) {
    const work = state.works.find((item) => item.id === id);
    if (!work) return;
    state.activeWorkId = id;
    saveNow(false);
    setView('editor');
  }

  function returnToLibrary() {
    state.activeWorkId = null;
    saveNow(false);
    setView('library');
  }

  function applyAtmosphere() {
    const work = currentWork();
    const atmosphere = work?.atmosphere || { season: 'spring', time: 'morning' };
    document.body.dataset.season = atmosphere.season;
    document.body.dataset.time = atmosphere.time;
    els.atmosphereIcon.textContent = seasonMeta[atmosphere.season].icon;
    els.atmosphereLabel.textContent = `${seasonMeta[atmosphere.season].label}・${timeMeta[atmosphere.time]}`;
    $$('[data-season-choice]').forEach((button) => button.classList.toggle('active', button.dataset.seasonChoice === atmosphere.season));
    $$('[data-time-choice]').forEach((button) => button.classList.toggle('active', button.dataset.timeChoice === atmosphere.time));
    renderParticles();
  }

  function renderParticles() {
    const holder = $('#particles');
    holder.replaceChildren();
    const work = currentWork();
    const season = currentView === 'editor' && work ? work.atmosphere.season : 'winter';
    const count = window.matchMedia('(max-width: 760px)').matches ? 10 : 18;
    for (let i = 0; i < count; i += 1) {
      const p = document.createElement('i');
      p.className = 'particle';
      const size = season === 'winter' ? 2 + Math.random() * 4 : 2 + Math.random() * 3;
      p.style.width = `${size}px`;
      p.style.height = season === 'autumn' ? `${size * 1.8}px` : `${size}px`;
      p.style.left = `${Math.random() * 100}%`;
      p.style.top = `${-20 + Math.random() * 100}%`;
      p.style.setProperty('--drift-x', `${-90 + Math.random() * 180}px`);
      p.style.animationDuration = `${12 + Math.random() * 18}s`;
      p.style.animationDelay = `${-Math.random() * 24}s`;
      holder.appendChild(p);
    }
  }

  function renderLibrary() {
    els.workCount.textContent = String(state.works.length);
    els.workSortSelect.value = state.sortMode;
    const query = els.workSearchInput.value.trim().toLocaleLowerCase('ja');
    let works = [...state.works];
    if (state.sortMode === 'updated') works.sort((a, b) => b.updatedAt - a.updatedAt);
    if (state.sortMode === 'title') works.sort((a, b) => a.projectTitle.localeCompare(b.projectTitle, 'ja'));
    if (query) works = works.filter((work) => work.projectTitle.toLocaleLowerCase('ja').includes(query));

    els.workGrid.replaceChildren();
    if (works.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-library';
      empty.innerHTML = query
        ? '<strong>NO MATCH</strong><span>該当する作品がありません。</span>'
        : '<strong>NO WORKS</strong><span>NEW WORKから最初の作品を作成してください。</span>';
      els.workGrid.appendChild(empty);
      return;
    }

    works.forEach((work) => {
      const fragment = els.workCardTemplate.content.cloneNode(true);
      const card = $('.work-card', fragment);
      card.dataset.workId = work.id;
      $('.work-atmosphere-icon', card).textContent = seasonMeta[work.atmosphere.season].icon;
      $('.work-updated', card).textContent = formatUpdated(work.updatedAt);
      $('.work-title', card).textContent = work.projectTitle || '名称未設定';
      $('.work-preview', card).textContent = makeWorkPreview(work);
      $('.work-chapter-count', card).textContent = String(work.chapters.length);
      $('.work-reference-count', card).textContent = String(work.references.length);
      $('.work-open', card).addEventListener('click', () => openWork(work.id));

      const more = $('.work-more', card);
      const popover = $('.work-popover', card);
      more.addEventListener('click', (event) => {
        event.stopPropagation();
        closePopovers(popover);
        popover.hidden = !popover.hidden;
      });
      $$('[data-work-action]', popover).forEach((button) => {
        const action = button.dataset.workAction;
        if ((action === 'up' || action === 'down') && state.sortMode !== 'manual') button.hidden = true;
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          handleWorkAction(work.id, action);
          popover.hidden = true;
        });
      });
      els.workGrid.appendChild(fragment);
    });
  }

  function makeWorkPreview(work) {
    const chapter = work.chapters.find((item) => item.subtitle.trim() || item.content.trim()) || work.chapters[0];
    const source = chapter ? (chapter.subtitle.trim() || chapter.content.trim()) : '';
    if (!source) return 'まだプロットは書かれていません。';
    return source.length > 72 ? `${source.slice(0, 72)}…` : source;
  }

  function formatUpdated(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'UPDATED';
    const current = new Date();
    const sameDay = date.getFullYear() === current.getFullYear() && date.getMonth() === current.getMonth() && date.getDate() === current.getDate();
    const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    if (sameDay) return `TODAY ${time}`;
    if (date.getFullYear() === current.getFullYear()) return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  }

  function handleWorkAction(id, action) {
    const index = state.works.findIndex((work) => work.id === id);
    if (index < 0) return;
    const work = state.works[index];
    if (action === 'duplicate') {
      const copy = duplicateWork(work);
      state.works.splice(index + 1, 0, copy);
      scheduleSave();
      renderLibrary();
      return;
    }
    if (action === 'up' && index > 0) {
      [state.works[index - 1], state.works[index]] = [state.works[index], state.works[index - 1]];
    } else if (action === 'down' && index < state.works.length - 1) {
      [state.works[index + 1], state.works[index]] = [state.works[index], state.works[index + 1]];
    } else if (action === 'delete') {
      if (!confirm(`「${work.projectTitle || 'この作品'}」を削除しますか？`)) return;
      state.works.splice(index, 1);
      if (state.activeWorkId === id) state.activeWorkId = null;
    } else {
      return;
    }
    scheduleSave();
    renderLibrary();
  }

  function duplicateWork(source, customTitle = '') {
    const copy = clone(source);
    copy.id = uid();
    copy.projectTitle = customTitle.trim() || `${source.projectTitle || '新しい物語'} コピー`;
    copy.createdAt = now();
    copy.updatedAt = copy.createdAt;
    copy.references = copy.references.map((item) => ({ ...item, id: uid() }));
    copy.chapters = copy.chapters.map((chapter) => ({ ...chapter, id: uid() }));
    return copy;
  }

  function openNewWorkDialog() {
    els.newWorkTitle.value = '';
    els.newWorkMode.value = 'blank';
    populateDuplicateSources();
    toggleNewWorkMode();
    els.workDialog.showModal();
    setTimeout(() => els.newWorkTitle.focus(), 80);
  }

  function populateDuplicateSources() {
    els.duplicateSourceSelect.replaceChildren();
    state.works.forEach((work) => {
      const option = document.createElement('option');
      option.value = work.id;
      option.textContent = work.projectTitle;
      els.duplicateSourceSelect.appendChild(option);
    });
  }

  function toggleNewWorkMode() {
    const duplicate = els.newWorkMode.value === 'duplicate';
    els.duplicateSourceField.hidden = !duplicate;
    if (duplicate && state.works.length === 0) {
      els.newWorkMode.value = 'blank';
      els.duplicateSourceField.hidden = true;
    }
  }

  function createWork() {
    const title = els.newWorkTitle.value.trim();
    let work;
    if (els.newWorkMode.value === 'duplicate') {
      const source = state.works.find((item) => item.id === els.duplicateSourceSelect.value);
      if (!source) {
        alert('複製元の作品が見つかりません。');
        return;
      }
      work = duplicateWork(source, title || `${source.projectTitle} コピー`);
    } else {
      work = makeBlankWork(title || '新しい物語');
    }
    state.works.push(work);
    state.activeWorkId = work.id;
    saveNow();
    els.workDialog.close();
    setView('editor');
  }

  function renderEditor() {
    const work = currentWork();
    if (!work) {
      setView('library');
      return;
    }
    els.projectTitle.value = work.projectTitle;
    applyAtmosphere();
    renderReferences();
    renderChapters();
  }

  function renderReferences() {
    const work = currentWork();
    if (!work) return;
    const cast = work.references.filter((item) => item.type === 'cast');
    const facts = work.references.filter((item) => item.type === 'fact');
    els.castCount.textContent = String(cast.length);
    els.factCount.textContent = String(facts.length);
    els.castList.replaceChildren(...(cast.length ? cast.map(makeCastCard) : [makeEmpty('人物を追加')]));
    els.factList.replaceChildren(...(facts.length ? facts.map(makeFactCard) : [makeEmpty('固定情報を追加')]));
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
    button.innerHTML = '<div class="cast-card-head"><span class="cast-name"></span><span class="cast-age"></span></div><div class="cast-spelling"></div><div class="cast-role"></div><p class="card-note"></p>';
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
    const work = currentWork();
    if (!work) return;
    els.chapterList.replaceChildren();
    work.chapters.forEach((chapter, index) => {
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
        touchWork(work);
        if (chapter.open) requestAnimationFrame(() => autoSizeTextarea(content));
      });
      titleInput.addEventListener('input', () => { chapter.title = titleInput.value; touchWork(work); });
      subtitleInput.addEventListener('input', () => { chapter.subtitle = subtitleInput.value; touchWork(work); });
      content.addEventListener('input', () => {
        chapter.content = content.value;
        count.textContent = String(chapter.content.length);
        autoSizeTextarea(content);
        touchWork(work);
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
    $$('.chapter-popover, .work-popover').forEach((popover) => {
      if (popover !== except) popover.hidden = true;
    });
  }

  function addChapter(afterIndex = null) {
    const work = currentWork();
    if (!work) return;
    const insertAfter = afterIndex === null ? work.chapters.length - 1 : afterIndex;
    const chapter = { id: uid(), title: `第${work.chapters.length + 1}章`, subtitle: '', content: '', open: true };
    work.chapters.splice(insertAfter + 1, 0, chapter);
    renderChapters();
    touchWork(work);
    requestAnimationFrame(() => {
      const input = $(`[data-chapter-id="${CSS.escape(chapter.id)}"] .chapter-title-input`);
      input?.focus();
      input?.select();
    });
  }

  function handleChapterAction(id, action) {
    const work = currentWork();
    if (!work) return;
    const index = work.chapters.findIndex((chapter) => chapter.id === id);
    if (index < 0) return;
    if (action === 'up' && index > 0) {
      [work.chapters[index - 1], work.chapters[index]] = [work.chapters[index], work.chapters[index - 1]];
    } else if (action === 'down' && index < work.chapters.length - 1) {
      [work.chapters[index + 1], work.chapters[index]] = [work.chapters[index], work.chapters[index + 1]];
    } else if (action === 'duplicate') {
      const copy = { ...clone(work.chapters[index]), id: uid(), title: `${work.chapters[index].title} コピー` };
      work.chapters.splice(index + 1, 0, copy);
    } else if (action === 'delete') {
      if (work.chapters.length === 1) {
        alert('章は最低1つ必要です。');
        return;
      }
      if (!confirm(`「${work.chapters[index].title || 'この章'}」を削除しますか？`)) return;
      work.chapters.splice(index, 1);
    } else {
      return;
    }
    renderChapters();
    touchWork(work);
  }

  function openReferenceDialog(id = null) {
    const work = currentWork();
    if (!work) return;
    const item = id ? work.references.find((ref) => ref.id === id) : null;
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
    const work = currentWork();
    if (!work) return;
    const type = els.referenceType.value;
    const id = els.referenceId.value;
    const existingIndex = work.references.findIndex((item) => item.id === id);
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
    if (existingIndex >= 0) work.references.splice(existingIndex, 1, item);
    else work.references.push(item);
    renderReferences();
    touchWork(work);
    els.referenceDialog.close();
  }

  function deleteReference() {
    const work = currentWork();
    if (!work) return;
    const id = els.referenceId.value;
    const item = work.references.find((ref) => ref.id === id);
    if (!item) return;
    const title = item.type === 'cast' ? item.name : item.label;
    if (!confirm(`「${title || 'この項目'}」を削除しますか？`)) return;
    work.references = work.references.filter((ref) => ref.id !== id);
    renderReferences();
    touchWork(work);
    els.referenceDialog.close();
  }

  function setAllChapters(open) {
    const work = currentWork();
    if (!work) return;
    work.chapters.forEach((chapter) => { chapter.open = open; });
    renderChapters();
    touchWork(work);
  }

  function exportCurrentWork() {
    const work = currentWork();
    if (!work) return;
    saveNow(false);
    downloadJson({ kind: 'frame-work', version: VERSION, work }, `${safeFilename(work.projectTitle)}_FRAME.json`);
  }

  function exportLibrary() {
    saveNow(false);
    downloadJson({ kind: 'frame-library', version: VERSION, library: state }, 'FRAME_ALL_WORKS.json');
  }

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function safeFilename(value) {
    return (value || 'FRAME').replace(/[\\/:*?"<>|]/g, '_');
  }

  async function importData(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const libraryPayload = parsed?.kind === 'frame-library' ? parsed.library : (Array.isArray(parsed?.works) ? parsed : null);
      const workPayload = parsed?.kind === 'frame-work' ? parsed.work : (looksLikeWork(parsed) ? parsed : null);

      if (libraryPayload) {
        if (!confirm('現在の作品一覧を、読み込んだデータで置き換えますか？')) return;
        state = normalizeLibrary(libraryPayload);
        state.activeWorkId = null;
        saveNow();
        els.settingsDialog.close();
        setView('library');
      } else if (workPayload) {
        const work = normalizeWork(workPayload, workPayload.projectTitle || '読み込んだ作品');
        work.id = uid();
        work.createdAt = now();
        work.updatedAt = work.createdAt;
        work.references = work.references.map((item) => ({ ...item, id: uid() }));
        work.chapters = work.chapters.map((chapter) => ({ ...chapter, id: uid() }));
        state.works.push(work);
        state.activeWorkId = work.id;
        saveNow();
        els.settingsDialog.close();
        setView('editor');
      } else {
        throw new Error('unsupported FRAME data');
      }
    } catch (error) {
      console.error(error);
      alert('FRAMEのJSONデータを読み込めませんでした。');
    } finally {
      els.importInput.value = '';
    }
  }

  function duplicateCurrentWork() {
    const work = currentWork();
    if (!work) return;
    const index = state.works.findIndex((item) => item.id === work.id);
    const copy = duplicateWork(work);
    state.works.splice(index + 1, 0, copy);
    state.activeWorkId = copy.id;
    saveNow();
    els.settingsDialog.close();
    renderEditor();
  }

  function deleteCurrentWork() {
    const work = currentWork();
    if (!work) return;
    if (!confirm(`「${work.projectTitle || 'この作品'}」を削除しますか？`)) return;
    state.works = state.works.filter((item) => item.id !== work.id);
    state.activeWorkId = null;
    saveNow();
    els.settingsDialog.close();
    setView('library');
  }

  function resetLibrary() {
    if (!confirm('FRAME内の全作品を初期化しますか？')) return;
    if (!confirm('この操作は元に戻せません。本当に初期化しますか？')) return;
    state = makeDefaultLibrary();
    saveNow();
    els.settingsDialog.close();
    setView('library');
  }

  function openSettings() {
    const editor = currentView === 'editor';
    $$('.editor-only-setting').forEach((item) => { item.hidden = !editor; });
    $$('.library-only-setting').forEach((item) => { item.hidden = editor; });
    els.settingsDialog.showModal();
  }

  els.workSearchInput.addEventListener('input', renderLibrary);
  els.workSortSelect.addEventListener('change', () => {
    state.sortMode = els.workSortSelect.value;
    scheduleSave(false);
    renderLibrary();
  });
  $('#newWorkButton').addEventListener('click', openNewWorkDialog);
  els.newWorkMode.addEventListener('change', toggleNewWorkMode);
  $('#createWorkButton').addEventListener('click', createWork);
  $('#backToWorksButton').addEventListener('click', returnToLibrary);

  els.projectTitle.addEventListener('input', () => {
    const work = currentWork();
    if (!work) return;
    work.projectTitle = els.projectTitle.value;
    touchWork(work);
  });
  els.atmosphereButton.addEventListener('click', () => els.atmosphereDialog.showModal());
  $('#settingsButton').addEventListener('click', openSettings);
  $('#librarySettingsButton').addEventListener('click', openSettings);
  $('#helpButton').addEventListener('click', () => els.helpDialog.showModal());
  $('#libraryHelpButton').addEventListener('click', () => els.helpDialog.showModal());
  $('#addReferenceButton').addEventListener('click', () => openReferenceDialog());
  els.referenceType.addEventListener('change', toggleReferenceFields);
  $('#saveReferenceButton').addEventListener('click', saveReference);
  els.deleteReferenceButton.addEventListener('click', deleteReference);
  $('#addChapterButton').addEventListener('click', () => addChapter());
  $('#bottomAddChapterButton').addEventListener('click', () => addChapter());
  $('#openAllButton').addEventListener('click', () => setAllChapters(true));
  $('#closeAllButton').addEventListener('click', () => setAllChapters(false));
  $('#exportCurrentButton').addEventListener('click', exportCurrentWork);
  $('#exportLibraryButton').addEventListener('click', exportLibrary);
  $('#duplicateCurrentButton').addEventListener('click', duplicateCurrentWork);
  $('#deleteCurrentButton').addEventListener('click', deleteCurrentWork);
  $('#resetLibraryButton').addEventListener('click', resetLibrary);
  els.importInput.addEventListener('change', () => importData(els.importInput.files?.[0]));

  $$('[data-season-choice]').forEach((button) => button.addEventListener('click', () => {
    const work = currentWork();
    if (!work) return;
    work.atmosphere.season = button.dataset.seasonChoice;
    applyAtmosphere();
    touchWork(work);
  }));
  $$('[data-time-choice]').forEach((button) => button.addEventListener('click', () => {
    const work = currentWork();
    if (!work) return;
    work.atmosphere.time = button.dataset.timeChoice;
    applyAtmosphere();
    touchWork(work);
  }));

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.chapter-menu') && !event.target.closest('.work-menu')) closePopovers();
  });
  window.addEventListener('resize', () => {
    $$('.chapter-card.open .chapter-content').forEach(autoSizeTextarea);
  });
  window.addEventListener('beforeunload', () => saveNow(false));

  renderLibrary();
  renderParticles();
  saveNow(false);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js?v=10').catch((error) => console.warn('FRAME SW', error)));
  }
})();
