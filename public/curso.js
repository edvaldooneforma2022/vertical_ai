/* ===============================================
   Link Mágico Academy — Course Platform JS
   Hotmart-style sidebar navigation, inline player,
   materials grid, and document redirect logic.
   =============================================== */

(function () {
    'use strict';

    // Wait for DOM ready
    function ready(fn) {
        if (document.readyState !== 'loading') {
            fn();
        } else {
            document.addEventListener('DOMContentLoaded', fn);
        }
    }

    ready(function () {
        // ============================================
        // DOM REFERENCES
        // ============================================
        var sidebar = document.getElementById('sidebar');
        var sidebarToggle = document.getElementById('sidebarToggle');
        var sidebarOverlay = document.getElementById('sidebarOverlay');
        var welcomeScreen = document.getElementById('welcomeScreen');
        var playerArea = document.getElementById('playerArea');
        var playerFrame = document.getElementById('playerFrame');
        var playerContainer = document.getElementById('playerContainer');
        var materialsGrid = document.getElementById('materialsGrid');
        var lessonInfo = document.getElementById('lessonInfo');
        var lessonTitle = document.getElementById('lessonTitle');
        var lessonDesc = document.getElementById('lessonDesc');
        var lessonBadge = document.getElementById('lessonBadge');
        var btnPrev = document.getElementById('btnPrevLesson');
        var btnNext = document.getElementById('btnNextLesson');

        // Document modal refs removed to favor direct redirect/new tab

        // Collect all lesson items
        var allLessons = [];
        var lessonNodes = document.querySelectorAll('.lesson-item');
        for (var i = 0; i < lessonNodes.length; i++) {
            allLessons.push(lessonNodes[i]);
        }
        var totalLessons = allLessons.length;
        var currentIndex = -1;

        // ============================================
        // MODULE ACCORDION & GRID TRIGGER
        // ============================================
        var moduleHeaders = document.querySelectorAll('.module-header');

        for (var m = 0; m < moduleHeaders.length; m++) {
            (function (header) {
                header.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var list = header.nextElementSibling;
                    if (!list) return;

                    var isMaterials = header.textContent.toLowerCase().indexOf('materiais') !== -1;

                    if (list.classList.contains('open') && !isMaterials) {
                        list.classList.remove('open');
                        header.classList.remove('active');
                        header.setAttribute('aria-expanded', 'false');
                    } else {
                        // Close other modules
                        for (var x = 0; x < moduleHeaders.length; x++) {
                            if (moduleHeaders[x] !== header) {
                                moduleHeaders[x].classList.remove('active');
                                if (moduleHeaders[x].nextElementSibling) {
                                    moduleHeaders[x].nextElementSibling.classList.remove('open');
                                }
                            }
                        }
                        list.classList.add('open');
                        header.classList.add('active');
                        header.setAttribute('aria-expanded', 'true');

                        if (isMaterials) showMaterialsGrid();
                    }
                });
            })(moduleHeaders[m]);
        }

        function showMaterialsGrid() {
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            if (playerArea) playerArea.style.display = 'block';
            if (playerContainer) playerContainer.style.display = 'none';
            if (lessonInfo) lessonInfo.style.display = 'none';
            if (materialsGrid) materialsGrid.classList.add('active');
            closeSidebar();
        }

        // ============================================
        // LESSON SELECTION LOGIC
        // ============================================
        for (var j = 0; j < allLessons.length; j++) {
            (function (idx) {
                allLessons[idx].addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    selectLesson(idx);
                });
            })(j);
        }

        /* Doc Card click */
        var docCards = document.querySelectorAll('.doc-card');
        for (var c = 0; c < docCards.length; c++) {
            (function (card) {
                card.addEventListener('click', function () {
                    var id = card.getAttribute('data-doc-id');
                    var title = card.getAttribute('data-doc-title');
                    openDocument(id, title);
                });
            })(docCards[c]);
        }

        function openDocument(id, title) {
            if (!id) return;
            // Force direct download as requested for HTML files
            var driveUrl = 'https://drive.google.com/uc?export=download&id=' + id;
            window.open(driveUrl, '_blank');
        }

        function selectLesson(index) {
            if (index < 0 || index >= totalLessons) return;

            var item = allLessons[index];
            var type = item.getAttribute('data-type');
            var title = item.getAttribute('data-lesson-title') || '';
            var desc = item.getAttribute('data-lesson-desc') || '';

            if (type === 'doc') {
                openDocument(item.getAttribute('data-doc-id'), title);
                return;
            }

            // Update active state in sidebar
            for (var k = 0; k < allLessons.length; k++) {
                allLessons[k].classList.remove('active');
            }
            item.classList.add('active');

            // Switch UI states
            if (welcomeScreen) welcomeScreen.style.display = 'none';
            if (playerArea) playerArea.style.display = 'block';
            if (materialsGrid) materialsGrid.classList.remove('active');
            if (playerContainer) playerContainer.style.display = 'block';
            if (lessonInfo) lessonInfo.style.display = 'block';

            // Load content
            if (type === 'video') {
                var videoId = item.getAttribute('data-video-id');
                if (playerFrame && videoId) {
                    playerFrame.src = 'https://drive.google.com/file/d/' + videoId + '/preview';
                }
                var lessonNum = item.querySelector('.lesson-number');
                if (lessonBadge) {
                    lessonBadge.textContent = lessonNum ? 'Aula ' + lessonNum.textContent.trim() : 'Vídeo';
                }
            }

            // Update text
            if (lessonTitle) lessonTitle.textContent = title || 'Sem título';
            if (lessonDesc) lessonDesc.textContent = desc || '';

            currentIndex = index;
            updateNavButtons();
            closeSidebar();

            var contentArea = document.getElementById('contentArea');
            if (contentArea) {
                try { contentArea.scrollTop = 0; } catch (err) { }
            }
        }

        // ============================================
        // NAVIGATION
        // ============================================
        function updateNavButtons() {
            if (btnPrev) btnPrev.disabled = (currentIndex <= 0);
            if (btnNext) btnNext.disabled = (currentIndex >= totalLessons - 1);
        }

        if (btnPrev) {
            btnPrev.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (currentIndex > 0) selectLesson(currentIndex - 1);
            });
        }

        if (btnNext) {
            btnNext.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (currentIndex < totalLessons - 1) selectLesson(currentIndex + 1);
            });
        }

        function openSidebar() {
            if (sidebar) sidebar.classList.add('open');
            if (sidebarOverlay) sidebarOverlay.classList.add('active');
        }

        function closeSidebar() {
            if (sidebar) sidebar.classList.remove('open');
            if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        }

        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (sidebar && sidebar.classList.contains('open')) closeSidebar();
                else openSidebar();
            });
        }

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', function () {
                closeSidebar();
            });
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                closeSidebar();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', function (e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (currentIndex > 0) selectLesson(currentIndex - 1);
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                if (currentIndex < totalLessons - 1) selectLesson(currentIndex + 1);
            }
        });

        // Initial auto-load (first video)
        for (var i = 0; i < allLessons.length; i++) {
            if (allLessons[i].getAttribute('data-type') === 'video') {
                selectLesson(i);
                break;
            }
        }
    });

})();
