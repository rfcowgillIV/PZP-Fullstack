// public/js/nav.js
// Smooth scrolling for the home page navbar.
//
// SECURITY UPDATE (2026): this code used to live in an inline <script> block at
// the bottom of index.html. It moved here so the server's Content-Security-Policy
// can block every inline script - which means even if someone sneaks HTML into
// the page, their <script> won't run.
//
// BUG FIX (2026): the old version attached the "Event Pictures" handler to the
// page heading (#eventPictures) instead of the navbar link, so clicking the link
// jumped instead of scrolling. There were also two links sharing the id
// "eventPicturesbutton" (ids must be unique). Both fixed; the second link is now
// "reviewbutton" and just goes to the review page normally.
//
// Five nearly identical click handlers were also squeezed into one loop.
// We scroll-ed back on the repetition.

$(function () {
    // navbar link id  ->  section it should glide to
    const scrollTargets = {
        '#homebutton': '#my-jumbotron',
        '#aboutbutton': '#about',
        '#crewbutton': '#crew',
        '#schedulebutton': '#schedule',
        '#eventPicturesbutton': '#eventPictures',
    };

    Object.keys(scrollTargets).forEach(function (linkSelector) {
        $(linkSelector).on('click', function (event) {
            const $target = $(scrollTargets[linkSelector]);
            if (!$target.length) return; // section missing? let the browser handle it
            event.preventDefault();
            $('html, body').animate({ scrollTop: $target.offset().top }, 2000);
        });
    });

    // Any other element with class="schedule" (like the big "book us" buttons)
    // also scrolls down to the schedule. Time to get this party scheduled.
    $('.schedule').not('#schedulebutton').on('click', function (event) {
        const $target = $('#schedule');
        if (!$target.length) return;
        event.preventDefault();
        $('html, body').animate({ scrollTop: $target.offset().top }, 2000);
    });
});
