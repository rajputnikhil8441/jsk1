/* menu.js — toggles the Pages dropdown next to Register.
   Click the button to open/close. Click anywhere else to close.
   The button's aria-expanded always mirrors the open class, so a screen
   reader is told the same thing the sighted user is shown. */
(function () {
    document.addEventListener('DOMContentLoaded', function () {
        var menus = document.querySelectorAll('.pagemenu');

        function sync(menu) {
            var btn = menu.querySelector('.pagemenu-btn');
            if (btn) btn.setAttribute('aria-expanded', menu.classList.contains('open') ? 'true' : 'false');
        }
        function closeAll(except) {
            menus.forEach(function (m) {
                if (m === except) return;
                m.classList.remove('open');
                sync(m);
            });
        }

        menus.forEach(function (menu) {
            var btn = menu.querySelector('.pagemenu-btn');
            if (!btn) return;
            sync(menu);
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                // close others, toggle this one
                closeAll(menu);
                menu.classList.toggle('open');
                sync(menu);
            });
        });

        // Click outside closes any open menu
        document.addEventListener('click', function () { closeAll(null); });

        // Esc closes too
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeAll(null);
        });
    });
})();
