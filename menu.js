/* menu.js — toggles the Pages dropdown next to Register.
   Click the button to open/close. Click anywhere else to close. */
(function () {
    document.addEventListener('DOMContentLoaded', function () {
        var menus = document.querySelectorAll('.pagemenu');

        menus.forEach(function (menu) {
            var btn = menu.querySelector('.pagemenu-btn');
            if (!btn) return;
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                // close others, toggle this one
                menus.forEach(function (m) { if (m !== menu) m.classList.remove('open'); });
                menu.classList.toggle('open');
            });
        });

        // Click outside closes any open menu
        document.addEventListener('click', function () {
            menus.forEach(function (m) { m.classList.remove('open'); });
        });

        // Esc closes too
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                menus.forEach(function (m) { m.classList.remove('open'); });
            }
        });
    });
})();
