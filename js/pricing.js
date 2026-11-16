/* House of Perfection: price list interactions (search, category chips, sticky offset, print) */
(function () {
	'use strict';

	var root = document.documentElement;
	var toolbar = document.querySelector('[data-toolbar]');
	var chips = Array.prototype.slice.call(document.querySelectorAll('[data-chip]'));
	var sections = Array.prototype.slice.call(document.querySelectorAll('[data-cat]'));
	var input = document.getElementById('hop-search');
	var clearBtn = document.querySelector('.hop-search-clear');
	var statusEl = document.querySelector('.hop-search-status');
	var emptyEl = document.querySelector('.hop-empty');
	var emptyTerm = document.querySelector('[data-empty-term]');
	if (!toolbar || !sections.length) return;

	/* ---------- sticky offset: sit just below the theme's fixed / stuck navbar */
	function navOffset() {
		var bottom = 0;
		var els = document.querySelectorAll('.rd-navbar-panel, .rd-navbar-main-outer, .rd-navbar');
		for (var i = 0; i < els.length; i++) {
			var cs = window.getComputedStyle(els[i]);
			if (cs.position === 'fixed' && cs.visibility !== 'hidden' && cs.display !== 'none') {
				var r = els[i].getBoundingClientRect();
				if (r.top <= 1 && r.bottom > bottom && r.height < 200) bottom = r.bottom;
			}
		}
		return Math.max(0, Math.round(bottom));
	}

	var ticking = false;
	function onScroll() {
		if (ticking) return;
		ticking = true;
		window.requestAnimationFrame(function () {
			root.style.setProperty('--hop-sticky-top', navOffset() + 'px');
			toolbar.classList.toggle('is-stuck', toolbar.getBoundingClientRect().top <= navOffset() + 1);
			ticking = false;
		});
	}
	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('resize', onScroll);
	onScroll();

	/* ---------- active chip while scrolling */
	function setActive(id) {
		chips.forEach(function (c) {
			var on = c.getAttribute('data-chip') === id;
			c.classList.toggle('is-active', on);
			if (on) {
				c.setAttribute('aria-current', 'true');
				var bar = c.parentNode;
				var left = c.offsetLeft - 16;
				if (left < bar.scrollLeft || c.offsetLeft + c.offsetWidth > bar.scrollLeft + bar.clientWidth) {
					bar.scrollTo({ left: left, behavior: 'smooth' });
				}
			} else {
				c.removeAttribute('aria-current');
			}
		});
	}

	if ('IntersectionObserver' in window) {
		var visible = {};
		var io = new IntersectionObserver(function (entries) {
			entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting ? e.intersectionRatio : 0; });
			var best = null, bestRatio = 0;
			sections.forEach(function (s) {
				if ((visible[s.id] || 0) > bestRatio) { best = s.id; bestRatio = visible[s.id]; }
			});
			if (best) setActive(best);
		}, { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.01, 0.25, 0.5, 1] });
		sections.forEach(function (s) { io.observe(s); });
	}

	chips.forEach(function (c) {
		c.addEventListener('click', function (ev) {
			var target = document.getElementById(c.getAttribute('data-chip'));
			if (!target) return;
			ev.preventDefault();
			ev.stopPropagation();
			var y = target.getBoundingClientRect().top + window.pageYOffset - navOffset() - toolbar.offsetHeight - 12;
			window.scrollTo({ top: y, behavior: 'smooth' });
			if (history.replaceState) history.replaceState(null, '', '#' + target.id);
			setActive(target.id);
		});
	});

	/* deep link (e.g. pricing.html#nails from a treatment page) once layout settles */
	if (location.hash && document.getElementById(location.hash.slice(1))) {
		window.addEventListener('load', function () {
			var t = document.getElementById(location.hash.slice(1));
			setTimeout(function () {
				window.scrollTo({ top: t.getBoundingClientRect().top + window.pageYOffset - navOffset() - toolbar.offsetHeight - 12 });
			}, 80);
		});
	}

	/* ---------- search / filter */
	var rows = Array.prototype.slice.call(document.querySelectorAll('.hop-table tr'));
	var nameEls = Array.prototype.slice.call(document.querySelectorAll('.hop-name, .hop-detail, .hop-feature .hop-card-title'));
	nameEls.forEach(function (el) { el.setAttribute('data-orig', el.innerHTML); });

	function norm(s) {
		return (s || '').toLowerCase().replace(/&[a-z]+;/g, ' ').replace(/[^a-z0-9+%½¾ ]+/g, ' ').replace(/\s+/g, ' ').trim();
	}

	function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

	function highlight(terms) {
		nameEls.forEach(function (el) {
			var html = el.getAttribute('data-orig');
			if (terms.length) {
				var re = new RegExp('(' + terms.map(escapeRe).join('|') + ')(?![^<]*>)', 'gi');
				html = html.replace(re, '<mark class="hop-hl">$1</mark>');
			}
			el.innerHTML = html;
		});
	}

	function hide(el, yes) {
		if (yes) el.setAttribute('data-filter-hidden', ''); else el.removeAttribute('data-filter-hidden');
	}

	function filter() {
		var q = norm(input.value);
		var terms = q ? q.split(' ').filter(Boolean) : [];
		clearBtn.hidden = !q;
		var total = 0;

		sections.forEach(function (sec) {
			var catText = norm(sec.querySelector('.hop-cat-title').textContent);
			var catMatch = terms.length && terms.every(function (t) { return catText.indexOf(t) > -1; });
			var cards = Array.prototype.slice.call(sec.querySelectorAll('[data-filter-card]'));

			function run(showAll) {
				var count = 0;
				cards.forEach(function (card) {
					var head = norm((card.querySelector('.hop-card-head, .hop-feature-top') || card).textContent);
					var cardCount = 0;
					var cardRows = card.querySelectorAll('.hop-table tr');
					if (cardRows.length) {
						cardRows.forEach(function (tr) {
							var txt = norm(tr.textContent) + ' ' + head;
							var ok = showAll || !terms.length || terms.every(function (t) { return txt.indexOf(t) > -1; });
							hide(tr, !ok);
							if (ok) cardCount++;
						});
					} else {
						var ftxt = norm(card.textContent);
						cardCount = (showAll || !terms.length || terms.every(function (t) { return ftxt.indexOf(t) > -1; })) ? 1 : 0;
					}
					hide(card, cardCount === 0);
					count += cardCount;
				});
				return count;
			}

			var secCount = run(false);
			if (secCount === 0 && catMatch) secCount = run(true); // e.g. "nails" or "laser": show the whole category

			hide(sec, secCount === 0);
			var chip = document.querySelector('[data-chip="' + sec.id + '"]');
			if (chip) chip.classList.toggle('is-dim', secCount === 0);
			total += secCount;
		});

		highlight(terms);
		emptyEl.hidden = !(terms.length && total === 0);
		if (emptyTerm) emptyTerm.textContent = input.value.trim();
		statusEl.textContent = terms.length ? (total ? total + (total === 1 ? ' treatment' : ' treatments') + ' found' : '') : '';
	}

	var t;
	input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(filter, 120); });
	input.addEventListener('keydown', function (e) {
		if (e.key === 'Escape') { input.value = ''; filter(); }
	});
	clearBtn.addEventListener('click', function () { input.value = ''; filter(); input.focus(); });

	document.addEventListener('keydown', function (e) {
		var tag = (document.activeElement && document.activeElement.tagName) || '';
		if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag)) { e.preventDefault(); input.focus(); }
	});

	/* ---------- print: always print the full list */
	function resetForPrint() { if (input.value) { input.value = ''; filter(); } }
	window.addEventListener('beforeprint', resetForPrint);
	var printBtn = document.querySelector('[data-print]');
	if (printBtn) printBtn.addEventListener('click', function () { resetForPrint(); window.print(); });
})();
